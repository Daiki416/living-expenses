import { supabase } from './supabase'
import type { Category } from './supabase'
import { TAX_RATE, MEDIA_TYPE, MEDIA_TYPE_VALUES } from '../config/classifications'
import { MESSAGES } from '../config/messages'
import { SETTINGS } from '../config/settings'

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

// カテゴリー一覧を親→その子らの自然な順でフラット化し、Haiku 送信用の index 付きリストにする。
// 出力は「葉（子を持たないカテゴリー）」のみ。子は label=`親名 > 子名`、
// childless親（旧データ・子を持たない親）は葉として label=name で残す。
// 親グループ順・子順は崩さず、子を持つ親の単体行だけを落とす（Edge Function と同順・同長を保つ）。
// 件数は 50 件で打ち切る。
export function buildCategoryOptions(categories: Category[]): { index: number; label: string; id: string }[] {
  const parents = categories.filter(c => c.parent_id === null)
  const options: { label: string; id: string }[] = []
  for (const parent of parents) {
    const children = categories.filter(c => c.parent_id === parent.id)
    if (children.length === 0) {
      // childless親は葉として救済（親名 label）。
      options.push({ label: parent.name, id: parent.id })
      continue
    }
    for (const child of children) {
      options.push({ label: `${parent.name} > ${child.name}`, id: child.id })
    }
  }
  return options.slice(0, SETTINGS.maxCategoryOptions).map((o, index) => ({ index, label: o.label, id: o.id }))
}

// Haiku が返した index を options 上の id に解決する。整数かつ範囲内のときのみ id、それ以外は null。
export function resolveCategoryIndex(index: unknown, options: { id: string }[]): string | null {
  if (typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < options.length) {
    return options[index].id
  }
  return null
}

export const DEFAULT_SCAN_TAX_RATE: TaxRate = TAX_RATE.INCLUSIVE

// 許可 MIME の実値は src/config の MEDIA_TYPE を単一源泉とする。型（union）・throw 挙動は不変。
type AllowedMediaType = typeof MEDIA_TYPE[keyof typeof MEDIA_TYPE]

export function toMediaType(rawType: string): AllowedMediaType {
  if (MEDIA_TYPE_VALUES.includes(rawType)) {
    return rawType as AllowedMediaType
  }
  throw new Error(MESSAGES.ocr.unsupportedImageType(rawType))
}

export function applyTax(amount: number, taxRate: TaxRate): number {
  if (taxRate === 0) return amount
  return Math.floor(amount * (1 + taxRate / 100))
}

export function toTaxRate(rawValue: number): TaxRate {
  if (rawValue === TAX_RATE.REDUCED || rawValue === TAX_RATE.STANDARD || rawValue === TAX_RATE.INCLUSIVE) return rawValue
  return TAX_RATE.REDUCED
}

// OCR経路の unknown な taxRate を検証する。0|8|10 のみ採用し、それ以外は 8。
export function resolveTaxRate(value: unknown): TaxRate {
  return value === TAX_RATE.REDUCED || value === TAX_RATE.STANDARD || value === TAX_RATE.INCLUSIVE ? value : TAX_RATE.REDUCED
}

export function hasValidAmount(amount: number | null): boolean {
  return amount !== null && Number.isInteger(amount) && amount > 0
}

export function isValidScanItem(item: ScanItem): boolean {
  return item.selected && item.description.trim() !== '' && hasValidAmount(item.amount)
}

export function fileToBase64(file: File): Promise<string> {
  if (file.size > SETTINGS.maxFileSizeBytes) {
    return Promise.reject(new Error(MESSAGES.ocr.fileTooLarge(SETTINGS.maxFileSizeBytes / 1024 / 1024)))
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

  if (error) throw new Error(error.message ?? MESSAGES.ocr.edgeCallFailed)
  if (data == null) throw new Error(MESSAGES.ocr.edgeBadResponse)

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
