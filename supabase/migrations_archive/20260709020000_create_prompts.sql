-- OCR プロンプト等の設定文字列を DB 管理するための prompts テーブルを作成する。
-- 中身（レコード）は本 migration では投入しない。真実の源は src/config/prompts.ts で、
-- `npm run config:push`（service_role）が UPSERT で流し込む。
--
-- 適用前提:
--   1. このテーブルは service_role からのみ読み書きする想定（Edge Function がプロンプト取得に使用）。
--   2. RLS を有効化しつつポリシーを一切作らないことで、anon / authenticated からのアクセスを
--      全面的に拒否する（＝フロントには公開しない）。プロンプト文言をクライアントに露出させないため。
--   3. service_role は RLS をバイパスするため、ポリシー無しでも config:push / Edge から読み書きできる。

create table prompts (
  id bigint generated always as identity primary key,
  name text not null unique,
  content text not null
);

-- RLS 有効化。ポリシーは意図的に作らない（service_role 専用。anon/authenticated は拒否）。
alter table prompts enable row level security;
