import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = ['*']
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const OCR_MODEL = 'claude-haiku-4-5-20251001'
const OCR_MAX_TOKENS = 1024
const ANTHROPIC_API_VERSION = '2023-06-01'

const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
// クライアント側の上限 5MB を base64 化した長さ（約6.9M文字）+ 余裕
const MAX_BASE64_LENGTH = 7_200_000

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Authorization header missing' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: 'Supabase environment variables not set' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicApiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  let base64: string
  let mediaType: string
  try {
    const body = await req.json()
    base64 = body.base64
    mediaType = body.mediaType
    if (typeof base64 !== 'string' || base64 === '' || typeof mediaType !== 'string') throw new Error('missing fields')
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) {
    return new Response(JSON.stringify({ error: 'サポートされていない画像形式です' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  if (base64.length > MAX_BASE64_LENGTH) {
    return new Response(JSON.stringify({ error: '画像ファイルは5MB以下にしてください' }), {
      status: 413,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicApiKey,
      'anthropic-version': ANTHROPIC_API_VERSION,
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
              text: 'このレシート画像から店舗名と全ての商品・品目を抽出し、以下のJSON形式のみで返してください。\n{"storeName":"店舗名（不明な場合はnull）","date":"YYYY-MM-DD形式の購入日（不明な場合はnull）","items":[{"description":"商品名","amount":商品行に印字されている金額の整数}]}\n各商品のamountは印字された数字をそのままコピーしてください。税計算は不要です。\n小計・合計・税額・値引き等の集計行はitemsに含めないでください。JSONのみ返してください。',
            },
          ],
        },
      ],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('Anthropic API error:', body)
    return new Response(JSON.stringify({ error: `OCR API エラー: ${res.status}` }), {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const json = await res.json()
  const text: string = json.content?.[0]?.text ?? ''

  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('JSON not found')
    const data = JSON.parse(match[0])

    type ReceiptItem = { description: string; amount: number }
    function isReceiptItem(item: unknown): item is ReceiptItem {
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

    const receiptItems: ReceiptItem[] = Array.isArray(data.items) ? data.items.filter(isReceiptItem) : []
    const result = {
      storeName: typeof data.storeName === 'string' ? data.storeName : null,
      date: typeof data.date === 'string' ? data.date : null,
      items: receiptItems.map((item) => ({ description: item.description, amount: Math.round(item.amount) })),
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'レシートのデータを解析できませんでした' }), {
      status: 422,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
