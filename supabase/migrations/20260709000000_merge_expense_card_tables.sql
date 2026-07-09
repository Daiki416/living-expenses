-- 立替とクレカの重複データモデルを統合する。
-- 旧 card_* テーブルは本マイグレーションでは削除しない（検証後に別途撤去）。
--
-- 適用前チェックリスト:
--   1. 事前バックアップを取得すること（pg_dump 等）。
--   2. card_expense_receipts / card_expenses の実列が下の SELECT 句と一致するか確認すること
--      （想定: card_expense_receipts(id,date,description,created_at) /
--              card_expenses(id,receipt_id,description,amount,category_id,created_at)）。
--   3. 移送前後の件数照合:
--      receipts 件数 == 旧 expense_receipts 件数 + card_expense_receipts 件数
--      expenses 件数 == 旧 expenses 件数 + card_expenses 件数
--
-- RLS: rename により expense_receipts のポリシーは receipts に引き継がれる。
--      expenses のポリシーはそのまま。世帯共有モデルのため USING(true) を維持し、
--      user_id / household_id は追加しない。

-- 立替レシートを receipts へリネームし、kind 列を追加する。
-- kind は 'advance'（立替）/ 'card'（クレカ）のみ。REST 直叩き等での不正値混入を DB で弾く。
alter table expense_receipts rename to receipts;
alter table receipts add column kind text not null default 'advance'
  check (kind in ('advance', 'card'));

-- クレカ支出は paid_by を持たないため nullable 化する。
alter table expenses alter column paid_by drop not null;

-- クレカレシートを receipts へ移送する（id を維持）。
insert into receipts (id, date, description, kind, created_at)
  select id, date, description, 'card', created_at from card_expense_receipts;

-- クレカ支出を expenses へ移送する（paid_by は null）。
insert into expenses (id, receipt_id, description, amount, category_id, paid_by, created_at)
  select id, receipt_id, description, amount, category_id, null, created_at from card_expenses;

-- 以降は kind をアプリ側で明示するため default を外す。
alter table receipts alter column kind drop default;
