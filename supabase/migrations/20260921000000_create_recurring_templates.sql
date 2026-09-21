-- 自動明細（定期テンプレ）機能。
--   毎月指定日に、テンプレ通りのレシート＋明細を pg_cron が冪等に自動登録する。
--   スケジュール処理はサーバ側のみで走らせ、クライアントでは一切実行しない。
--
-- モデル:
--   recurring_templates       … 親（支払い手段・登録日・有効フラグ）。既存 receipts と同じ
--                               kind⟺paid_by 連動 CHECK を持つ。
--   recurring_template_items  … 明細（説明・金額・カテゴリー・並び順）。親削除で CASCADE。
--   recurring_runs            … 実行記録。(template_id, period_ym) の UNIQUE で月内冪等を担保する。
--
-- RLS 方針: 世帯共有モデル（USING(true)）を維持し、authenticated のみ読み書き可能とする。
--   既存 migration ファイルは書き換えない（append-only）。手本は account_state migration。
--   add_receipt_group（SECURITY INVOKER）はシグネチャを変えずに呼ぶだけ。

-- 1. テーブル定義。
create table if not exists public.recurring_templates (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  kind text not null check (kind in ('advance', 'card')),
  paid_by_member_id uuid references members(id),
  day_of_month int not null check (day_of_month between 1 and 31),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint recurring_templates_description_ck check (btrim(description) <> ''),
  constraint recurring_templates_kind_paid_by_ck check
    ((kind = 'card' and paid_by_member_id is null)
      or (kind = 'advance' and paid_by_member_id is not null))
);

create table if not exists public.recurring_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references recurring_templates(id) on delete cascade,
  description text not null,
  amount int not null check (amount > 0),
  category_id uuid references categories(id) on delete set null,
  constraint recurring_template_items_description_ck check (btrim(description) <> ''),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.recurring_runs (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references recurring_templates(id) on delete cascade,
  period_ym text not null,
  receipt_id uuid references receipts(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, period_ym)
);

-- 2. RLS（世帯共有モデル・account_state と同形）。
alter table public.recurring_templates enable row level security;
create policy "recurring_templates_authenticated_only" on public.recurring_templates
  to authenticated using (true) with check (true);
grant all on table public.recurring_templates to anon, authenticated, service_role;

alter table public.recurring_template_items enable row level security;
create policy "recurring_template_items_authenticated_only" on public.recurring_template_items
  to authenticated using (true) with check (true);
grant all on table public.recurring_template_items to anon, authenticated, service_role;

-- recurring_runs は pg_cron の冪等性を担保する内部制御台帳。フロントは一切参照・書込しない。
--   RLS は有効のまま authenticated 向け許可ポリシーを張らず（＝クライアント遮断）、
--   権限も service_role のみに絞る。SECURITY DEFINER の run_recurring_templates は
--   所有者（postgres）権限で書けるため、この絞りでも冪等処理は動く。
--   public スキーマの default privileges が新規テーブルに anon/authenticated ALL を
--   自動付与するため、明示 REVOKE で取り消してから service_role のみに GRANT する。
alter table public.recurring_runs enable row level security;
revoke all on table public.recurring_runs from anon, authenticated;
grant all on table public.recurring_runs to service_role;

-- 3. pg_cron 実行関数。
--    冪等順序: 記録 INSERT（ON CONFLICT DO NOTHING）を先 → found の時だけ add_receipt_group →
--    receipt_id を更新する。関数全体が例外なら当日分だけロールバックし翌日再試行する
--    （取りこぼしの一括登録はしない）。JST 基準・過去非遡及（作成月より前は挿入しない）。
create or replace function public.run_recurring_templates() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_ym text := to_char(v_today, 'YYYY-MM');
  v_last_day int := extract(day from (date_trunc('month', v_today) + interval '1 month' - interval '1 day'));
  t record;
  v_result jsonb;
begin
  for t in
    select * from recurring_templates
    where active
      and least(day_of_month, v_last_day) = extract(day from v_today)
      and date_trunc('month', (created_at at time zone 'Asia/Tokyo')::date) <= date_trunc('month', v_today)
    for update
  loop
    insert into recurring_runs (template_id, period_ym)
      values (t.id, v_ym) on conflict (template_id, period_ym) do nothing;
    if not found then continue; end if;
    select public.add_receipt_group(
      v_today, t.description, t.kind, t.paid_by_member_id,
      (select coalesce(jsonb_agg(jsonb_build_object(
                'description', i.description, 'amount', i.amount, 'category_id', i.category_id)
              order by i.sort_order), '[]'::jsonb)
       from recurring_template_items i where i.template_id = t.id)
    ) into v_result;
    update recurring_runs set receipt_id = (v_result->>'id')::uuid
      where template_id = t.id and period_ym = v_ym;
  end loop;
end; $$;

-- run_recurring_templates は SECURITY DEFINER（postgres 所有者権限）。作成時に PUBLIC へ
--   EXECUTE が既定付与されるため、PostgREST 経由で anon/authenticated が手動発火できる。
--   これはクライアント遮断の設計境界を破るので、PUBLIC と anon/authenticated から明示 REVOKE し、
--   pg_cron（DBオーナー実行）の保険として service_role のみに GRANT する。
revoke execute on function public.run_recurring_templates() from public;
revoke execute on function public.run_recurring_templates() from anon, authenticated;
grant execute on function public.run_recurring_templates() to service_role;

-- 4. cron.schedule 登録（冪等・ローカルに pg_cron が無くても push を失敗させない）。
--    JST 00:10 = UTC 15:10。
--    pg_cron の可用性で分岐する。搭載環境（本番/対応ローカル）では create+schedule を
--    例外で隠さず実行し、権限・シグネチャ・名前衝突などの失敗は顕在化させて migration を
--    失敗させる。非搭載環境ではスキップし、テーブル/関数生成だけで push を通す。
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule('run_recurring_templates')
      where exists (select 1 from cron.job where jobname = 'run_recurring_templates');
    perform cron.schedule('run_recurring_templates', '10 15 * * *',
                          $q$select public.run_recurring_templates();$q$);
  else
    raise notice 'pg_cron not available; skipping schedule (tables/functions still created)';
  end if;
end $$;

-- 5. フロント CRUD 用 RPC。
--    add_receipt_group と同形の返却（親 + items）にする。GRANT は既存踏襲で明示する。
create or replace function public.add_recurring_template(
  p_description text, p_kind text, p_paid_by_member_id uuid, p_day_of_month int, p_items jsonb
) returns jsonb language plpgsql as $$
declare v_template recurring_templates%rowtype; v_items jsonb;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'recurring template requires at least one item';
  end if;
  insert into recurring_templates (description, kind, paid_by_member_id, day_of_month)
    values (p_description, p_kind, p_paid_by_member_id, p_day_of_month)
    returning * into v_template;
  insert into recurring_template_items (template_id, description, amount, category_id, sort_order)
    select v_template.id, elem->>'description', (elem->>'amount')::int,
           nullif(elem->>'category_id', '')::uuid,
           coalesce((elem->>'sort_order')::int, ord::int - 1)
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as t(elem, ord);
  select coalesce(jsonb_agg(to_jsonb(i) order by i.sort_order), '[]'::jsonb)
    into v_items from recurring_template_items i where i.template_id = v_template.id;
  return to_jsonb(v_template) || jsonb_build_object('recurring_template_items', v_items);
end; $$;

create or replace function public.update_recurring_template(
  p_id uuid, p_description text, p_kind text, p_paid_by_member_id uuid, p_day_of_month int, p_items jsonb
) returns jsonb language plpgsql as $$
declare v_template recurring_templates%rowtype; v_items jsonb;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'recurring template requires at least one item';
  end if;
  update recurring_templates
    set description = p_description, kind = p_kind,
        paid_by_member_id = p_paid_by_member_id, day_of_month = p_day_of_month
    where id = p_id
    returning * into v_template;
  if not found then
    raise exception 'recurring template % not found', p_id;
  end if;
  -- 明細は原子的な行置換（全消し→再 INSERT）。
  delete from recurring_template_items where template_id = p_id;
  insert into recurring_template_items (template_id, description, amount, category_id, sort_order)
    select p_id, elem->>'description', (elem->>'amount')::int,
           nullif(elem->>'category_id', '')::uuid,
           coalesce((elem->>'sort_order')::int, ord::int - 1)
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as t(elem, ord);
  select coalesce(jsonb_agg(to_jsonb(i) order by i.sort_order), '[]'::jsonb)
    into v_items from recurring_template_items i where i.template_id = p_id;
  return to_jsonb(v_template) || jsonb_build_object('recurring_template_items', v_items);
end; $$;

grant execute on function public.add_recurring_template(text, text, uuid, int, jsonb)
  to anon, authenticated, service_role;
grant execute on function public.update_recurring_template(uuid, text, text, uuid, int, jsonb)
  to anon, authenticated, service_role;
