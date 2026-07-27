-- 引き落とし口座の残高シミュレーション用テーブル。
--   口座残高（手入力）・翌月クレカ引落額（手入力）・残高計上日を単一行で保持する。
--   RLS 方針: 世帯共有モデル（USING(true)）を維持し、authenticated のみ読み書き可能とする。
--   id を boolean 主キー + CHECK(id) にして「常に true の1行のみ」を強制する（singleton）。

create table if not exists public.account_state (
  id boolean primary key default true,
  balance integer not null default 0,
  balance_as_of date,
  next_card_debit integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint account_state_singleton check (id)
);
alter table public.account_state enable row level security;
create policy "account_state_authenticated_only" on public.account_state
  to authenticated using (true) with check (true);
grant all on table public.account_state to anon, authenticated, service_role;
