# living-expenses

## プロジェクト概要

複数人の家計を管理するための個人向けWebアプリ。立替払いとクレジットカード支出を月別に記録し、メンバーごとの集計やカテゴリー別の内訳を確認できる。レシートをスキャンしてOCRで支出を一括登録する機能も備える。

**個人利用・セルフホスト前提**のため、いくつかの設計トレードオフを意図的に許容している（後述）。

---

## 技術スタック

| 役割 | 技術 |
|------|------|
| フロントエンド | React 19 + TypeScript + Vite |
| スタイリング | Tailwind CSS v4 |
| バックエンド/DB | Supabase (PostgreSQL + RLS) |
| OCR | Anthropic API (claude-haiku) |
| テスト | Vitest |

---

## ディレクトリ構成

```
src/
  components/       # UIコンポーネント
    AddExpenseModal.tsx       # 立替追加モーダル（レシートスキャン対応）
    AddCardExpenseModal.tsx   # クレカ追加モーダル（レシートスキャン対応）
    EditExpenseModal.tsx      # 立替編集モーダル
    EditCardExpenseModal.tsx  # クレカ編集モーダル
    SettingsModal.tsx         # メンバー・カテゴリー設定
    CategorySelect.tsx        # 親子カテゴリー選択UI
    ScanItemRow.tsx           # レシートスキャン明細行
    ExpenseList.tsx           # 立替一覧
    CardExpenseList.tsx       # クレカ一覧
    CategorySummary.tsx       # カテゴリー別集計
    ModalShell.tsx            # モーダル共通ラッパー
  hooks/            # カスタムフック
    useExpenses.ts            # 立替CRUD
    useCardExpenses.ts        # クレカCRUD
    useMembers.ts             # メンバーCRUD
    useCategories.ts          # カテゴリーCRUD
    useReceiptScan.ts         # レシートスキャンフロー
    useEscapeKey.ts           # Escキーハンドリング
  lib/              # ユーティリティ
    supabase.ts               # Supabaseクライアント・型定義
    ocr.ts                    # Anthropic API呼び出し・OCR処理
    validation.ts             # バリデーション・エラーメッセージ定数
    format.ts                 # フォーマットユーティリティ
    ocr.test.ts
    validation.test.ts
```

---

## 主要な仕様

### 支出の種類
- **立替**: メンバーが立て替えた支出。`paid_by` フィールドで誰が払ったかを記録
- **クレカ**: クレジットカードの支出。`paid_by` なし

### カテゴリー
- 親カテゴリー → 子カテゴリーの2階層構造
- `category_id` は子カテゴリーまたは親カテゴリーを直接指定
- `effectiveCategoryId = childCategoryId || parentCategoryId || null` で解決

### 税率
- 軽減税率対応: 8% / 10% / 税込（0%）の3値
- `TaxRate = 8 | 10 | 0` 型

### OCRフロー
1. ユーザーがレシート画像を選択
2. `extractReceiptData` で Anthropic API に送信
3. レシートの品目リストを返却（日付・説明・金額・税率）
4. ユーザーがレビュー画面で各品目の税率・選択状態を確認
5. 「N件を追加」で一括登録

---

## 既知の設計トレードオフ（指摘不要）

- `VITE_ANTHROPIC_API_KEY` をフロントエンドに保持 → **個人利用・セルフホストのため許容**
- Supabase AnonKey のフロントエンド保持 → **Supabase の設計上の前提**
- コンポーネントの結合テストなし → `@testing-library/react` 未導入、純粋関数のみ Vitest でテスト

---

## 開発コマンド

```bash
npm run dev          # 開発サーバー起動
npm run build        # ビルド
npm run test         # テスト実行（Vitest）
npm run test:watch   # テストウォッチモード
npx tsc -p tsconfig.app.json  # 型チェックのみ（noUnusedLocals も有効）
```

---

## 環境変数（.env）

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_ANTHROPIC_API_KEY=...
```
