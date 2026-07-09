// src/config/*（真実の源）を読み、Supabase に UPSERT するパイプライン。
// service_role キーを使うためフロントには載らない。DDL は migration、レコードはこのスクリプトで流す。
//
// 実行:
//   npm run config:push            … UPSERT のみ（file に無い DB 行は残す）
//   npm run config:push -- --prune … UPSERT に加え、file に無いキーの行を DB から削除する
//
// 必須 env（.env）:
//   VITE_SUPABASE_URL         … 既存のものを再利用
//   SUPABASE_SERVICE_ROLE_KEY … 新規。VITE_ プレフィックス無し（フロントに露出させない）

import { pathToFileURL } from 'node:url'
import ws from 'ws'
import { createClient } from '@supabase/supabase-js'
import { PROMPTS } from '../src/config/prompts.ts'

// Node < 22 は native WebSocket を持たず、supabase-js が createClient 時に Realtime を
// 初期化して throw する。config:push は REST(UPSERT) しか使わず Realtime は不要だが、
// createClient が必ず Realtime を生成するため、WebSocket をポリフィルして通す。
if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === 'undefined') {
  ;(globalThis as { WebSocket?: unknown }).WebSocket = ws
}

// 同期対象テーブルのレジストリ。今回は prompts のみ。将来ここに追加して拡張する。
type Registry = {
  table: string
  conflictKey: string
  rows: Record<string, unknown>[]
}

const REGISTRY: Registry[] = [
  { table: 'prompts', conflictKey: 'name', rows: PROMPTS },
]

// file に無いキー（= DB から削除すべきキー）を算出する純粋関数。
export function keysToPrune(fileKeys: string[], dbKeys: string[]): string[] {
  const fileSet = new Set(fileKeys)
  return dbKeys.filter((k) => !fileSet.has(k))
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`環境変数 ${name} が未設定です（.env を確認してください）`)
  return value
}

async function main() {
  const prune = process.argv.slice(2).includes('--prune')

  const url = requireEnv('VITE_SUPABASE_URL')
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  // 接続先を1行表示（prune 事故＝本番/検証の取り違えに気づけるように）。
  console.log(`→ target: ${url}`)

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  })

  for (const { table, conflictKey, rows } of REGISTRY) {
    const { error } = await supabase.from(table).upsert(rows, { onConflict: conflictKey })
    if (error) throw new Error(`${table} の UPSERT に失敗しました: ${error.message}`)
    console.log(`✓ ${table}: ${rows.length} upserted`)

    if (prune) {
      const { data, error: selectError } = await supabase.from(table).select(conflictKey)
      if (selectError) throw new Error(`${table} の取得に失敗しました: ${selectError.message}`)
      const dbKeys = (data ?? []).map((r) => String((r as Record<string, unknown>)[conflictKey]))
      const fileKeys = rows.map((r) => String(r[conflictKey]))
      const pruneKeys = keysToPrune(fileKeys, dbKeys)
      // 削除の実行前に、対象URL・件数・キー一覧を表示してから DELETE する（非対話のまま）。
      if (pruneKeys.length > 0) {
        console.log(`  prune target: ${url} / ${table} → ${pruneKeys.length} 件削除予定: ${pruneKeys.join(', ')}`)
        const { error: deleteError } = await supabase.from(table).delete().in(conflictKey, pruneKeys)
        if (deleteError) throw new Error(`${table} の削除に失敗しました: ${deleteError.message}`)
      }
      console.log(`✗ ${table}: ${pruneKeys.length} pruned`)
    }
  }
}

// CLI として直接実行されたときだけ main() を走らせる。
// import された場合（純粋関数 keysToPrune の利用等）は DB 接続を起こさない。
const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : ''
if (import.meta.url === invokedPath) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
