-- 明細読み込み高速化のためのインデックス追加。
-- 明細取得は receipts を date 範囲で絞り込み date 降順で並べ、さらにネストで
-- expenses(*) を receipt_id で引く。いずれも索引が無く本番データ量で seq scan になり遅い。
--   1) receipts.date       … 月範囲の絞り込み＋order by date に効く
--   2) expenses.receipt_id … FK は Postgres が自動索引しないため、ネスト取得の結合に効く
-- CREATE INDEX はトランザクション内で実行される（Supabase migration の既定）ため
-- CONCURRENTLY は使わない。個人利用のデータ量なら一時ロックは軽微。
create index if not exists idx_receipts_date on public.receipts (date);
create index if not exists idx_expenses_receipt_id on public.expenses (receipt_id);
