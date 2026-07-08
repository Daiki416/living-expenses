# living-expenses

複数人の家計を管理するための個人向けWebアプリです。立替払いとクレジットカード支出を月別に記録し、メンバー別・カテゴリー別の集計を確認できます。レシート画像のOCR登録にも対応しています。

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- Supabase PostgreSQL + RLS
- Supabase Edge Functions
- Vitest

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

`.env` には Supabase の公開URLと anon key を設定します。

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

OCR用の `ANTHROPIC_API_KEY` はフロントエンドの `.env` には置かず、Supabase Edge Function のシークレットとして設定します。

```bash
supabase secrets set ANTHROPIC_API_KEY=...
```

## Commands

```bash
npm run dev
npm run build
npm run test
npm run lint
npx tsc -p tsconfig.app.json
```

## Notes

- 個人利用・セルフホスト前提です。
- Supabase anon key はフロントエンドに置く前提です。
- 詳細な仕様と設計上の前提は `CLAUDE.md` を参照してください。
