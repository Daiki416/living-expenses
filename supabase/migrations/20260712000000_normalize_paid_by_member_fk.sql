-- 立替者を名前テキストから members(id) への FK へ正規化する堅牢化リファクタ。
-- 旧構造では expenses.paid_by にメンバー「名」を保持していたため、
-- メンバー改名や表記ゆれ・NULL 混入で立替者が壊れうる。ここで receipts に
-- paid_by_member_id uuid（FK）を新設し、kind と連動を DB CHECK で強制する。
-- 立替者は id で保持し、表示時に members で id→名前解決する。
--
-- 前提（本リポジトリに基底テーブルの create 文が無いため既存 migration から推定）:
--   receipts: id uuid, date date, description text,
--             kind text (check in ('advance','card')), created_at
--   expenses: id uuid, receipt_id uuid, description text, amount int,
--             category_id uuid null, paid_by text null, created_at
--   members:  id uuid, name text, monthly_budget, created_at
--
-- RLS 方針:
--   ポリシー追加なし。世帯共有モデルの USING(true) を維持し、user_id/household_id は追加しない。
--   関数は SECURITY INVOKER（plpgsql デフォルト・明示しない）。SQL に税ロジックは持ち込まない。
--   既存 migration ファイルは書き換えない（append-only）。

-- 1. receipts に立替者の FK 列を追加する（nullable・デフォルトなし）。
alter table receipts add column paid_by_member_id uuid references members(id);

-- 2. バックフィル（CHECK 制約より前に実行）。
--    立替レシートの立替者名（expenses.paid_by の代表値）を members.id へ引き当てる。
--    1レシート1支払者前提のため max() で代表値を採る。kind='card' は null のまま。
update receipts r
set paid_by_member_id = m.id
from members m
where r.kind = 'advance'
  and m.name = (select max(e.paid_by) from expenses e where e.receipt_id = r.id);

-- 3. kind と paid_by_member_id の連動を DB CHECK で強制する。
--    card は必ず null、advance は必ず非 null。
alter table receipts add constraint receipts_kind_paid_by_ck
  check ((kind = 'card' and paid_by_member_id is null)
      or (kind = 'advance' and paid_by_member_id is not null));

-- 4. expenses.paid_by（名前テキスト）を廃止する。立替者は receipts で一元管理する。
alter table expenses drop column paid_by;

-- 5. 金額の非負制約を追加する。
alter table expenses add constraint expenses_amount_nonneg_ck check (amount >= 0);

-- 6. RPC の畳み込み。
--    (a) update_receipt_with_paid_by は不要になった（更新は単一行 UPDATE で足りる）ため削除する。
drop function if exists update_receipt_with_paid_by(uuid, text, date, text, text);

--    (b) add_receipt_group は引数型が変わる（=オーバーロード）ため、create or replace 不可。
--        必ず旧シグネチャを drop してから新規 create する。
drop function if exists add_receipt_group(date, text, text, jsonb);

create or replace function add_receipt_group(
  p_date date, p_description text, p_kind text, p_paid_by_member_id uuid, p_items jsonb
) returns jsonb language plpgsql as $$
declare v_receipt receipts%rowtype; v_expenses jsonb;
begin
  insert into receipts (date, description, kind, paid_by_member_id)
    values (p_date, p_description, p_kind, p_paid_by_member_id)
    returning * into v_receipt;
  insert into expenses (receipt_id, description, amount, category_id)
    select v_receipt.id, elem->>'description', (elem->>'amount')::int,
           nullif(elem->>'category_id','')::uuid
    from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) as elem;
  select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at), '[]'::jsonb)
    into v_expenses from expenses e where e.receipt_id = v_receipt.id;
  return to_jsonb(v_receipt) || jsonb_build_object('expenses', v_expenses);
end; $$;

-- 適用前チェックリスト（実行はユーザー手元）:
--   【結論】適用前に下記①②が「0件」でないと、手順3(連動CHECK)または手順5(amount>=0)で
--   適用が失敗する。特に旧 NULL バグで advance なのに paid_by=NULL のレシートは①に該当し、
--   連動CHECK 追加で確実に失敗する。適用前に該当行を手当てすること
--   （正しい member へ更新する or kind を card へ修正する）。
--
--   ① advance なのに立替者名が members に引き当たらない（=手順3の連動CHECKで失敗する）レシート:
--        select r.id, (select max(e.paid_by) from expenses e where e.receipt_id=r.id) as nm
--        from receipts r
--        where r.kind='advance'
--          and not exists (select 1 from members m
--            where m.name=(select max(e.paid_by) from expenses e where e.receipt_id=r.id));
--
--   ② amount が負の明細（=手順5の amount>=0 で失敗する）:
--        select id, amount from expenses where amount < 0;
--
--   ③ （任意・安全網）1レシート内に複数の立替者名が混在する行。仕様上は 1レシート1支払者で
--      発生しないが、手順2のバックフィルは max() で片方に丸めるため、万一混在があると
--      立替者が silently 誤変換される（適用は失敗しない＝気づけない）。不可逆 migration のため
--      適用前に 0件 を確認しておくと安全:
--        select receipt_id from expenses
--        where paid_by is not null group by receipt_id having count(distinct paid_by) >= 2;
--
--   注意:
--     - 事前に pg_dump 等でバックアップを取得すること。
--     - 単一適用前提（手順4で paid_by を DROP した後はバックフィル手順2を再実行できない）。
--     - `supabase db push` で適用する。両関数は SECURITY INVOKER のため GRANT は不要。
