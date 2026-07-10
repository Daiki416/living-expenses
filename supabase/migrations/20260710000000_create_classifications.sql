-- 区分マスタ（enum 相当）を DB 管理するための classifications テーブルを作成する。
-- 中身（レコード）は本 migration では投入しない。真実の源は src/config/classifications.ts で、
-- `npm run config:push`（service_role）が (class_name, code) を conflict キーに UPSERT で流し込む。
--
-- モデル:
--   code  … ソースのシンボル名（例 ADVANCE）。全て大文字。
--   value … 判定・DB業務列に入る実値（例 advance）。NOT NULL。業務データ列（receipts.kind 等）には
--           既に value が入っているためデータ移行は不要。
--   label … 表示用おまけ。nullable。
--
-- RLS 方針:
--   1. authenticated は SELECT のみ許可（フロントが税率 dropdown・区分ラベルを描画するため）。
--   2. 書き込みは service_role（config:push）のみ。service_role は RLS をバイパスするため、
--      書き込みポリシーは作らない。

create table classifications (
  id         bigint generated always as identity primary key,
  class_name text not null,
  code       text not null,
  value      text not null,
  label      text,
  sort_order int  not null default 0,
  meta       jsonb not null default '{}'::jsonb,
  unique (class_name, code)
);

alter table classifications enable row level security;

create policy "classifications_select" on classifications for select to authenticated using (true);
