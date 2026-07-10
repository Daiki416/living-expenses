// 区分マスタ（enum 相当）の「真実の源」。
// このファイルを編集し `npm run config:push` を実行すると classifications テーブルに UPSERT される。
//
// モデル:
//   code  … ソースに書くシンボル名（例 ADVANCE）。全て大文字。
//   value … 判定・DB業務列に入る実値（例 advance）。NOT NULL。receipts.kind 等には既にこの値が入っている。
//   label … 表示用おまけ。無ければ null。
//
// ドリフト防止のため、各区分の定義（*_DEFS）1つから CLASSIFICATIONS 配列（config:push 用）と
// 型付き定数（TAX_RATE 等・フロント消費用）の両方を導出する。既存型（TaxRate / ReceiptKind）は
// 変更せず、導出定数がそれらと値・型で一致することを satisfies で保証する。

import type { TaxRate } from '../lib/ocr'
import type { ReceiptKind } from '../lib/supabase'

// 区分の1定義。value は DB では text 列だが、tax_rate だけは数値で扱いたいので number も許容する。
// class_name は toRows() で分類ごとに一括付与するため、各定義行では持たせない。
// label が必須の分類（tax_rate / expense_kind）と、label 任意の分類（media_type）を型で区別する。
type LabeledClassDef = {
  code: string
  value: string | number
  label: string
}
type UnlabeledClassDef = {
  code: string
  value: string | number
  label?: string | null
}
type ClassDef = LabeledClassDef | UnlabeledClassDef

const TAX_RATE_DEFS = [
  { code: 'REDUCED', value: 8, label: '8%' },
  { code: 'STANDARD', value: 10, label: '10%' },
  { code: 'INCLUSIVE', value: 0, label: '税込' },
] as const satisfies readonly LabeledClassDef[]

const MEDIA_TYPE_DEFS = [
  { code: 'JPEG', value: 'image/jpeg' },
  { code: 'PNG', value: 'image/png' },
  { code: 'GIF', value: 'image/gif' },
  { code: 'WEBP', value: 'image/webp' },
] as const satisfies readonly UnlabeledClassDef[]

const EXPENSE_KIND_DEFS = [
  { code: 'ADVANCE', value: 'advance', label: '立替' },
  { code: 'CARD', value: 'card', label: 'クレカ' },
] as const satisfies readonly LabeledClassDef[]

// ---- config:push 用の行（DB の text 列に合わせ value は文字列化。label 未指定は null。sort_order は 1 始まり）----

export type ClassificationRow = {
  class_name: string
  code: string
  value: string
  label: string | null
  sort_order: number
}

function toRows(className: string, defs: readonly ClassDef[]): ClassificationRow[] {
  return defs.map((def, i) => ({
    class_name: className,
    code: def.code,
    value: String(def.value),
    label: def.label ?? null,
    sort_order: i + 1,
  }))
}

export const CLASSIFICATIONS: ClassificationRow[] = [
  ...toRows('tax_rate', TAX_RATE_DEFS),
  ...toRows('media_type', MEDIA_TYPE_DEFS),
  ...toRows('expense_kind', EXPENSE_KIND_DEFS),
]

// ---- フロント消費用の型付き定数（*_DEFS から導出。code をキー、value を値に持つオブジェクト）----

// code→value のマップを、リテラル値型を保ったまま組み立てる。
function deriveByCode<T extends readonly { code: string; value: unknown }[]>(
  defs: T,
): { [K in T[number]['code']]: Extract<T[number], { code: K }>['value'] } {
  const out = {} as { [K in T[number]['code']]: Extract<T[number], { code: K }>['value'] }
  for (const def of defs) {
    ;(out as Record<string, unknown>)[def.code] = def.value
  }
  return out
}

export const TAX_RATE = deriveByCode(TAX_RATE_DEFS) satisfies Record<string, TaxRate>

// ScanItemRow の税率 dropdown を sort_order 順で生成するための選択肢。
export const TAX_RATE_OPTIONS: readonly { value: TaxRate; label: string }[] =
  TAX_RATE_DEFS.map((def) => ({ value: def.value, label: def.label }))

export const EXPENSE_KIND = deriveByCode(EXPENSE_KIND_DEFS) satisfies Record<string, ReceiptKind>

// value → label のマップを、label 必須の定義から型安全に導出する。
// 定義から label を消すと constraint（label: string）を満たさなくなり、ここで tsc が落ちる。
function deriveLabelByValue<T extends readonly { value: string; label: string }[]>(
  defs: T,
): { [K in T[number]['value']]: string } {
  const out = {} as { [K in T[number]['value']]: string }
  for (const def of defs) {
    ;(out as Record<string, string>)[def.value] = def.label
  }
  return out
}

// value（'advance' 等）→ 表示ラベル（'立替' 等）のマップ。
export const EXPENSE_KIND_LABEL = deriveLabelByValue(EXPENSE_KIND_DEFS) satisfies Record<
  ReceiptKind,
  string
>

export const MEDIA_TYPE = deriveByCode(MEDIA_TYPE_DEFS)

// ocr.ts の ALLOWED_MEDIA_TYPES 導出用（許可 MIME の実値一覧）。
export const MEDIA_TYPE_VALUES: readonly string[] = MEDIA_TYPE_DEFS.map((def) => def.value)
