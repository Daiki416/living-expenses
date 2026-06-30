import { supabase } from './supabase'

export type TaxRate = 8 | 10 | 0

export type ScanItem = { description: string; amount: number; selected: boolean; taxRate: TaxRate }
export type ScanResult = { date: string; items: ScanItem[] }

type ReceiptItem = {
  description: string
  amount: number
}

type ReceiptData = {
  storeName: string | null
  date: string | null
  items: ReceiptItem[]
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

export function isValidScanItem(item: ScanItem): boolean {
  return item.selected && item.description.trim() !== '' && Number.isInteger(item.amount) && item.amount > 0
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

export function isReceiptItem(item: unknown): item is ReceiptItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof (item as ReceiptItem).description === 'string' &&
    (item as ReceiptItem).description.length > 0 &&
    (item as ReceiptItem).description.length <= 200 &&
    typeof (item as ReceiptItem).amount === 'number' &&
    Number.isFinite((item as ReceiptItem).amount) &&
    (item as ReceiptItem).amount > 0
  )
}

export async function extractReceiptData(imageFile: File): Promise<ReceiptData> {
  const base64 = await fileToBase64(imageFile)
  const mediaType = toMediaType(imageFile.type)

  const { data, error } = await supabase.functions.invoke('ocr', {
    body: { base64, mediaType },
  })

  if (error) throw new Error(error.message ?? 'OCR Edge Function の呼び出しに失敗しました')

  const receiptItems: ReceiptItem[] = Array.isArray(data.items) ? data.items.filter(isReceiptItem) : []
  return {
    storeName: typeof data.storeName === 'string' ? data.storeName : null,
    date: typeof data.date === 'string' ? data.date : null,
    items: receiptItems.map((item: ReceiptItem) => ({ description: item.description, amount: Math.round(item.amount) })),
  }
}
