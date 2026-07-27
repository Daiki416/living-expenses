-- account_state に引落日(既定4日)を追加。月末付近の日付ズレ回避のため上限28に制限。
alter table public.account_state
  add column if not exists debit_day integer not null default 4;
alter table public.account_state
  add constraint account_state_debit_day_range check (debit_day between 1 and 28);
