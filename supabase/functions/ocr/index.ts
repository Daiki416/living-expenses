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

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Supabase environment variables not set' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  // プロンプト設定は service_role 専用テーブル（RLS でフロント非公開）から取得する。
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

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

  // プロンプト本体は真実の源（src/config/prompts.ts → config:push で投入）を DB から読み出す。
  const { data: promptRows, error: promptError } = await supabaseAdmin
    .from('prompts')
    .select('name, content')
    .in('name', ['ocr.instructions', 'ocr.tax_rate', 'ocr.category'])

  const promptMap = new Map((promptRows ?? []).map((r) => [r.name as string, r.content as string]))
  const instructions = promptMap.get('ocr.instructions')
  const taxRatePrompt = promptMap.get('ocr.tax_rate')
  const category = promptMap.get('ocr.category')
  if (promptError || instructions === undefined || taxRatePrompt === undefined || category === undefined) {
    const missing = ['ocr.instructions', 'ocr.tax_rate', 'ocr.category'].filter((n) => !promptMap.has(n))
    console.error('プロンプト設定の取得に失敗:', promptError?.message, '欠落:', missing.join(', '))
    return new Response(JSON.stringify({ error: 'プロンプト設定が見つかりません' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  // itemShape はカテゴリ有無で 2 分岐する（コード側に残す仕様）。
  const itemShape = categories.length > 0
    ? '{"description":"商品名","amount":商品行に印字されている金額の整数,"taxRate":0か8か10,"category":番号またはnull}'
    : '{"description":"商品名","amount":商品行に印字されている金額の整数,"taxRate":0か8か10}'

  // プロンプト組み立て。置換値に $ が含まれても壊れないよう関数リプレーサを使う。
  // 最終文字列は従来の promptText と一字一句一致する（instructions + taxRate + カテゴリ時のみ category）。
  const instructionsResolved = instructions.replace('{item_shape}', () => itemShape)
  const categoryList = categories.map(c => `${c.index}: ${c.label}`).join('\n')
  const categoryResolved = category.replace('{category_list}', () => categoryList)
  const promptText = instructionsResolved + taxRatePrompt + (categories.length > 0 ? categoryResolved : '')

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
