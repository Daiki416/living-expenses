export type TaxRate = 8 | 10 | 0

export type ScanItem = { description: string; amount: number; selected: boolean; taxRate: TaxRate }
export type ScanResult = { date: string; items: ScanItem[] }

type ReceiptItem = {
  description: string
  amount: number
}

type ReceiptData = {
  date: string | null
  items: ReceiptItem[]
}

export const DEFAULT_SCAN_TAX_RATE: TaxRate = 8

const OCR_MODEL = 'claude-haiku-4-5-20251001'
const OCR_MAX_TOKENS = 1024
const ANTHROPIC_API_VERSION = '2023-06-01'

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
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY が設定されていません')

  const base64 = await fileToBase64(imageFile)
  const mediaType = toMediaType(imageFile.type)

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_API_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: OCR_MODEL,
      max_tokens: OCR_MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            {
              type: 'text',
              text: 'このレシート画像から全ての商品・品目を抽出し、以下のJSON形式のみで返してください。\n{"date":"YYYY-MM-DD形式の購入日（不明な場合はnull）","items":[{"description":"商品名","amount":商品行に印字されている金額の整数}]}\n各商品のamountは印字された数字をそのままコピーしてください。税計算は不要です。\n小計・合計・税額・値引き等の集計行はitemsに含めないでください。JSONのみ返してください。',
            },
          ],
        },
      ],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    if (import.meta.env.DEV) {
      console.error('OCR API エラーレスポンス:', body)
    }
    throw new Error(`OCR API エラー: ${res.status}`)
  }

  const json = await res.json()
  const text: string = json.content?.[0]?.text ?? ''

  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('JSON not found')
    const data = JSON.parse(match[0])
    const receiptItems: ReceiptItem[] = Array.isArray(data.items) ? data.items.filter(isReceiptItem) : []
    return {
      date: typeof data.date === 'string' ? data.date : null,
      items: receiptItems.map((item) => ({ description: item.description, amount: Math.round(item.amount) })),
    }
  } catch {
    throw new Error('レシートのデータを解析できませんでした')
  }
}
