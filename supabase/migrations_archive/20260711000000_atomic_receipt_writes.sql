-- レシート書き込みの原子化。
-- PostgREST は複数の from().update()/insert() をクライアント側で1トランザクションに束ねられず、
-- 各リクエストが個別に自動コミットされる。そのため useReceipts の updateReceipt / addReceiptGroup は
-- 「①receipts 書き込み → ②expenses 書き込み」の2段を分割実行しており、間で失敗すると DB 不整合が残る。
-- ここでは両処理を単一の plpgsql 関数（暗黙トランザクション）にまとめ、クライアントを 1回の rpc() 呼び出しに置換する。
--
-- 前提（本リポジトリに基底テーブルの create 文が無いため既存 migration から推定）:
--   receipts: id uuid (default gen_random_uuid()), date date, description text,
--             kind text (check in ('advance','card')), created_at (default now系)
--   expenses: id uuid (default gen_random_uuid()), receipt_id uuid references receipts(id),
--             description text, amount int（円・整数）, category_id uuid null, paid_by text null,
--             created_at
--
-- RLS 方針:
--   両関数とも SECURITY INVOKER（plpgsql デフォルト・明示しない）。呼び出しユーザー権限で実行され、
--   既存の世帯共有 RLS（authenticated に USING(true)）にそのまま従う。SECURITY DEFINER にはしない。
--   消費税計算はクライアント側（applyTax）のまま。SQL には税ロジックを持ち込まない（amount は適用済み整数を受領）。

-- (a) レシート更新の原子化。
--     receipts 本体の更新と、紐づく expenses.paid_by の一括更新を1トランザクションで実行する。
create or replace function update_receipt_with_paid_by(
  p_id uuid,
  p_description text,
  p_date date,
  p_kind text,
  p_paid_by text
) returns void
language plpgsql
as $$
begin
  update receipts
    set description = p_description, date = p_date, kind = p_kind
    where id = p_id;
  update expenses
    set paid_by = p_paid_by
    where receipt_id = p_id;
end;
$$;

-- (b) レシート追加の原子化。
--     receipts に1行 insert して id を得たのち、p_items（明細配列）を expenses へ一括 insert する。
--     生成された receipt 全列 + expenses 全行を ReceiptWithExpenses と同形の jsonb で返し、
--     クライアントのローカル state 更新に用いる。
--     p_items 要素: { description, amount, category_id, paid_by }
--       - amount     … 税適用済み整数（(elem->>'amount')::int）
--       - category_id … 未分類は null 可（nullif(elem->>'category_id','')::uuid）
--       - paid_by    … 空文字/未指定は null 扱い（nullif(elem->>'paid_by','')）
create or replace function add_receipt_group(
  p_date date,
  p_description text,
  p_kind text,
  p_items jsonb
) returns jsonb
language plpgsql
as $$
declare
  v_receipt receipts%rowtype;
  v_expenses jsonb;
begin
  insert into receipts (date, description, kind)
    values (p_date, p_description, p_kind)
    returning * into v_receipt;

  insert into expenses (receipt_id, description, amount, category_id, paid_by)
    select
      v_receipt.id,
      elem->>'description',
      (elem->>'amount')::int,
      nullif(elem->>'category_id', '')::uuid,
      nullif(elem->>'paid_by', '')
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as elem;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at), '[]'::jsonb)
    into v_expenses
    from expenses e
    where e.receipt_id = v_receipt.id;

  return to_jsonb(v_receipt) || jsonb_build_object('expenses', v_expenses);
end;
$$;

-- 適用前チェックリスト:
--   1. 事前バックアップを取得すること（pg_dump 等）。
--   2. 上記「前提」の列名・型（receipts/expenses）が実スキーマと一致するか確認すること。
--      特に amount が int、category_id/receipt_id が uuid、kind が text であること。
--   3. 本 migration は `supabase db push` で適用する。
--   4. 両関数は SECURITY INVOKER のため GRANT は不要（既存の RLS/権限にそのまま従う）。
