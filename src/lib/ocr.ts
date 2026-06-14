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
              text: 'このレシート画像から全ての商品・品目を抽出し、以下のJSON形式のみで返してください。\n{"date":"YYYY-MM-DD形式の購入日（不明な場合はnull）","items":[{"description":"商品名","amount":税込金額の整数}]}\n小計・合計・税額・値引きなどの集計行は items に含めないでください。JSONのみ返してください。',
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
    return {
      date: typeof data.date === 'string' ? data.date : null,
      items: Array.isArray(data.items)
        ? data.items
            .filter((i: unknown) => typeof (i as { description?: unknown }).description === 'string' && typeof (i as { amount?: unknown }).amount === 'number')
            .map((i: { description: string; amount: number }) => ({ description: i.description, amount: Math.round(i.amount) }))
        : [],
    }
  } catch {
    throw new Error('レシートのデータを解析できませんでした')
  }
}
