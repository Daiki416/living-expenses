import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = ['*']
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const OCR_MODEL = 'claude-haiku-4-5-20251001'
// カテゴリー判定の相乗りにより items 1件あたりの出力が増えるため 1024→1536 に引き上げ
const OCR_MAX_TOKENS = 1536
const ANTHROPIC_API_VERSION = '2023-06-01'

// クライアントから受け取るカテゴリー一覧の上限件数・label 最大長
const MAX_CATEGORY_OPTIONS = 50
const MAX_CATEGORY_LABEL_LENGTH = 60
// 改行・制御文字（\x00-\x1F, \x7F）
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1F\x7F]/g

// クライアントの categories をサニタイズし、サーバ側で index を 0..n-1 に振り直す。
// 順序のみ信頼し、index 値そのものは信用しない。
function sanitizeCategories(raw: unknown): { index: number; label: string }[] {
  if (!Array.isArray(raw)) return []
  const labels: string[] = []
  for (const item of raw.slice(0, MAX_CATEGORY_OPTIONS)) {
    const label = String((item as { label?: unknown })?.label ?? '')
      .replace(CONTROL_CHARS, '')
      .trim()
      .slice(0, MAX_CATEGORY_LABEL_LENGTH)
    if (label !== '') labels.push(label)
  }
  return labels.map((label, index) => ({ index, label }))
}

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
  let categories: { index: number; label: string }[]
  try {
    const body = await req.json()
    base64 = body.base64
    mediaType = body.mediaType
    categories = sanitizeCategories(body.categories)
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

  // カテゴリー一覧がある場合のみ、番号付き一覧と category 判定指示をプロンプトに追加する。
  const categoryPrompt = categories.length > 0
    ? `\n\n以下は選択可能なカテゴリーの一覧です。\n${categories.map(c => `${c.index}: ${c.label}`).join('\n')}\n各商品に最も適切なカテゴリーの番号を category に入れてください。該当が無ければ null にしてください。店舗名も判定の手がかりにしてよいです。`
    : ''
  const itemShape = categories.length > 0
    ? '{"description":"商品名","amount":商品行に印字されている金額の整数,"taxRate":0か8か10,"category":番号またはnull}'
    : '{"description":"商品名","amount":商品行に印字されている金額の整数,"taxRate":0か8か10}'
  const taxRatePrompt = `\n\n各商品のtaxRate（消費税率）を次の手順で判定してください。\n1. まず商品の印字金額が税込（内税・総額表示）か税抜（外税）かを判定する。「内」マークや「税込」表記があれば税込とみなし、taxRate=0を返す（この金額には後段で税を加算しないため）。\n2. 「外」（外税）マークなど税抜と判定できる場合のみ、税率を次で決める。\n   a. 商品行に軽減税率マーク（※, 軽, *, ⑧ 等）があれば8、標準税率マークがあれば10を優先する。\n   b. マークが無く、レシート末尾の税区分集計が1区分のみ（例:「10%対象」だけ）なら全商品をその率にする。\n   c. 8%対象と10%対象が併記されマークが無い場合は、食品・飲料は8、それ以外（酒類・日用品・雑貨等）は10とし、区分別対象額の合計が合うよう調整する。\n3. 税込か税抜か判別できない場合は8とする。`
  const promptText = `このレシート画像から店舗名と全ての商品・品目を抽出し、以下のJSON形式のみで返してください。\n{"storeName":"店舗名（不明な場合はnull）","date":"YYYY-MM-DD形式の購入日（不明な場合はnull）","items":[${itemShape}]}\n各商品のamountは印字された金額をそのままコピーしてください。税計算は不要です。\nただし特定の商品に紐づく値引き・割引がある場合は、その商品のamountを値引き後の金額にしてください。正味が印字されていれば（例:「¥216を¥198にしました」）その正味（198）を採用し、値引き額のみ印字されていれば（例:「-18」「値引 -18」）元金額から値引き額を引いた整数を採用してください。値引き行そのものをitemにしたり、マイナス金額のitemを作ったりしないでください。\n商品に紐づかないレシート全体のクーポン・割引は無視し、itemsに反映しないでください。\n小計・合計・税額の集計行はitemsに含めないでください。JSONのみ返してください。${taxRatePrompt}${categoryPrompt}`

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
              text: promptText,
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

    type ReceiptItem = { description: string; amount: number; taxRate?: unknown; category?: unknown }
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

    // category は「整数かつ 0..n-1」のみ採用し、それ以外は null にする。
    function resolveCategory(category: unknown): number | null {
      if (typeof category === 'number' && Number.isInteger(category) && category >= 0 && category < categories.length) {
        return category
      }
      return null
    }

    // taxRate は 0|8|10 のみ採用し、それ以外は 8 にフォールバックする。
    function resolveTaxRate(v: unknown): number {
      return v === 0 || v === 8 || v === 10 ? v : 8
    }

    const receiptItems: ReceiptItem[] = Array.isArray(data.items) ? data.items.filter(isReceiptItem) : []
    const result = {
      storeName: typeof data.storeName === 'string' ? data.storeName : null,
      date: typeof data.date === 'string' ? data.date : null,
      items: receiptItems.map((item) => ({
        description: item.description,
        amount: Math.round(item.amount),
        taxRate: resolveTaxRate(item.taxRate),
        category: resolveCategory(item.category),
      })),
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
