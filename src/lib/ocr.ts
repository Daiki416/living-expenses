import { supabase } from './supabase'
import type { Category } from './supabase'

export type TaxRate = 8 | 10 | 0

export type ScanItem = { description: string; amount: number | null; selected: boolean; taxRate: TaxRate; categoryId: string | null; categoryTouched: boolean }
export type ScanResult = { date: string; items: ScanItem[] }

// API から抽出した生の品目（category は index 想定・未解決）
type RawReceiptItem = {
  description: string
  amount: number
  taxRate?: unknown
}

// カテゴリー index を id に解決したあとの品目
type ReceiptItem = {
  description: string
  amount: number
  taxRate: TaxRate
  categoryId: string | null
}

type ReceiptData = {
  storeName: string | null
  date: string | null
  items: ReceiptItem[]
}

const MAX_CATEGORY_OPTIONS = 50

// カテゴリー一覧を親→その子らの自然な順でフラット化し、Haiku 送信用の index 付きリストにする。
// 親は label=name、子は label=`親名 > 子名`。件数は 50 件で打ち切る。
export function buildCategoryOptions(categories: Category[]): { index: number; label: string; id: string }[] {
  const parents = categories.filter(c => c.parent_id === null)
  const options: { label: string; id: string }[] = []
  for (const parent of parents) {
    options.push({ label: parent.name, id: parent.id })
    for (const child of categories.filter(c => c.parent_id === parent.id)) {
      options.push({ label: `${parent.name} > ${child.name}`, id: child.id })
    }
  }
  return options.slice(0, MAX_CATEGORY_OPTIONS).map((o, index) => ({ index, label: o.label, id: o.id }))
}

// Haiku が返した index を options 上の id に解決する。整数かつ範囲内のときのみ id、それ以外は null。
export function resolveCategoryIndex(index: unknown, options: { id: string }[]): string | null {
  if (typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < options.length) {
    return options[index].id
  }
  return null
}

export const DEFAULT_SCAN_TAX_RATE: TaxRate = 8

const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type AllowedMediaType = typeof ALLOWED_MEDIA_TYPES[number]

export function toMediaType(rawType: string): AllowedMediaType {
  if ((ALLOWED_MEDIA_TYPES as readonly string[]).includes(rawType)) {
    return rawType as AllowedMediaType
  }
  throw new Error(`サポートされていない画像形式です: ${rawType}`)
}

export function applyTax(amount: number, taxRate: TaxRate): number {
  if (taxRate === 0) return amount
  return Math.floor(amount * (1 + taxRate / 100))
}

export function toTaxRate(rawValue: number): TaxRate {
  if (rawValue === 8 || rawValue === 10 || rawValue === 0) return rawValue
  return 8
}

// OCR経路の unknown な taxRate を検証する。0|8|10 のみ採用し、それ以外は 8。
export function resolveTaxRate(value: unknown): TaxRate {
  return value === 8 || value === 10 || value === 0 ? value : 8
}

export function isValidScanItem(item: ScanItem): boolean {
  return item.selected && item.description.trim() !== '' && item.amount !== null && Number.isInteger(item.amount) && item.amount > 0
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

export function fileToBase64(file: File): Promise<string> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return Promise.reject(new Error('画像ファイルは5MB以下にしてください'))
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
    reader.readAsDataURL(file)
  })
}

// category フィールドの有無/型に関係なく description/amount のみで従来通り検証する
export function isReceiptItem(item: unknown): item is RawReceiptItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof (item as RawReceiptItem).description === 'string' &&
    (item as RawReceiptItem).description.length > 0 &&
    (item as RawReceiptItem).description.length <= 200 &&
    typeof (item as RawReceiptItem).amount === 'number' &&
    Number.isFinite((item as RawReceiptItem).amount) &&
    (item as RawReceiptItem).amount > 0
  )
}

export async function extractReceiptData(imageFile: File, categories: Category[]): Promise<ReceiptData> {
  const base64 = await fileToBase64(imageFile)
  const mediaType = toMediaType(imageFile.type)

  const options = buildCategoryOptions(categories)
  const sendList = options.map(({ index, label }) => ({ index, label }))

  const { data, error } = await supabase.functions.invoke('ocr', {
    body: { base64, mediaType, categories: sendList },
  })

  if (error) throw new Error(error.message ?? 'OCR Edge Function の呼び出しに失敗しました')
  if (data == null) throw new Error('OCR Edge Function のレスポンスが不正です')

  const rawItems: unknown[] = Array.isArray(data.items) ? data.items : []
  const items = rawItems
    .filter(isReceiptItem)
    .map((item) => ({
      description: item.description,
      amount: Math.round(item.amount),
      taxRate: resolveTaxRate((item as { taxRate?: unknown }).taxRate),
      categoryId: resolveCategoryIndex((item as { category?: unknown }).category, options),
    }))
  return {
    storeName: typeof data.storeName === 'string' ? data.storeName : null,
    date: typeof data.date === 'string' ? data.date : null,
    items,
  }
}
