-- 立替/クレカ統合（20260709000000）でデータ移送済みの旧クレカテーブルを
-- backup スキーマへ退避する。DROP はせず、しばらくロールバック用に保持する。
--
-- 効果:
--   - データは丸ごと保持される。
--   - Supabase の REST API は既定で public スキーマのみ公開するため、
--     backup へ移した時点で API から触れなくなる（誤書き込み・データ分岐の懸念が解消）。
--   - 完全撤去する場合は将来 `drop schema backup cascade;` を実行する。
--
-- 前提: 20260709000000_merge_expense_card_tables.sql が適用済みで、
--       card_expense_receipts / card_expenses がまだ public に存在すること。

create schema if not exists backup;

alter table card_expense_receipts set schema backup;
alter table card_expenses        set schema backup;
