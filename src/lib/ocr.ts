export type ScanItem = { description: string; amount: number; selected: boolean }
export type ScanResult = { date: string; items: ScanItem[] }

export type ReceiptItem = {
  description: string
  amount: number
}

export type ReceiptData = {
  date: string | null
  items: ReceiptItem[]
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function extractReceiptData(imageFile: File): Promise<ReceiptData> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY が設定されていません')

  const base64 = await fileToBase64(imageFile)
  const mediaType = imageFile.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            {
              type: 'text',
              text: 'このレシート画像から全ての商品・品目を抽出し、以下のJSON形式のみで返してください。\n{"date":"YYYY-MM-DD形式の購入日（不明な場合はnull）","tax_type":"外税 or 内税 or null","items":[{"description":"商品名","amount":商品行に印字された金額の整数,"tax_rate":適用税率の数値 or null}]}\n【tax_typeの判断】集計欄に「外〇%」があれば"外税"、「内〇%」「税込」があれば"内税"、判断できなければnull。\n【外税レシートのtax_rate判断手順】\n1. 集計欄の「外〇% 税対象 ¥XXX」の行から、このレシートで使われている税率区分（例: 外8%, 外10%）と各区分の対象合計金額を把握する\n2. 各商品行のマーカー（軽*、軽など軽減税率を示す記号）の有無を確認する\n3. 軽減税率マーカーがある商品 → 集計欄の最も低い税率を tax_rate に入れる\n4. マーカーがない商品 → 集計欄の最も高い税率を tax_rate に入れる\n5. 税率区分が1種類しかない場合は全商品にその税率を適用する\n【内税・判断不能の場合】tax_rateはnull\namountは必ず印字された金額をそのまま入れてください。税計算はしないでください。\n小計・合計・税額・値引きなどの集計行はitemsに含めないでください。JSONのみ返してください。',
            },
          ],
        },
      ],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OCR API エラー: ${res.status} ${body}`)
  }

  const json = await res.json()
  const text: string = json.content?.[0]?.text ?? ''

  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('JSON not found')
    const data = JSON.parse(match[0])
    const isPreTax = data.tax_type === '外税'
    return {
      date: typeof data.date === 'string' ? data.date : null,
      items: Array.isArray(data.items)
        ? data.items
            .filter((i: unknown) => typeof (i as { description?: unknown }).description === 'string' && typeof (i as { amount?: unknown }).amount === 'number')
            .map((i: { description: string; amount: number; tax_rate: number | null }) => {
              const base = Math.round(i.amount)
              const amount = isPreTax && typeof i.tax_rate === 'number'
                ? Math.floor(base * (1 + i.tax_rate / 100))
                : base
              return { description: i.description, amount }
            })
        : [],
    }
  } catch {
    throw new Error('レシートのデータを解析できませんでした')
  }
}
