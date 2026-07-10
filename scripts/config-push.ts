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
import { CLASSIFICATIONS } from '../src/config/classifications.ts'

// Node < 22 は native WebSocket を持たず、supabase-js が createClient 時に Realtime を
// 初期化して throw する。config:push は REST(UPSERT) しか使わず Realtime は不要だが、
// createClient が必ず Realtime を生成するため、WebSocket をポリフィルして通す。
if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === 'undefined') {
  ;(globalThis as { WebSocket?: unknown }).WebSocket = ws
}

// 同期対象テーブルのレジストリ。keyColumns は conflict / prune 同定に使う列（単一・複合どちらも可）。
type Registry = {
  table: string
  keyColumns: string[]
  rows: Record<string, unknown>[]
}

const REGISTRY: Registry[] = [
  { table: 'prompts', keyColumns: ['name'], rows: PROMPTS },
  { table: 'classifications', keyColumns: ['class_name', 'code'], rows: CLASSIFICATIONS },
]

// 複合キーを1本の識別子文字列に落とす（keysToPrune / prune 同定用）。区切りは値に現れない制御文字。
const KEY_SEPARATOR = String.fromCharCode(1)
function rowKey(row: Record<string, unknown>, keyColumns: string[], table: string): string {
  return keyColumns
    .map((col) => {
      if (!(col in row) || row[col] === null || row[col] === undefined) {
        throw new Error(`${table} の row にキー列 '${col}' がありません（keyColumns の指定を確認してください）`)
      }
      return String(row[col])
    })
    .join(KEY_SEPARATOR)
}

// file に無いキー（= DB から削除すべきキー）を算出する純粋関数。
// 複合キーは呼び出し側で識別子文字列に連結して渡すため、シグネチャは単一キー時代のまま維持する。
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

  for (const { table, keyColumns, rows } of REGISTRY) {
    const onConflict = keyColumns.join(',')
    const { error } = await supabase.from(table).upsert(rows, { onConflict })
    if (error) throw new Error(`${table} の UPSERT に失敗しました: ${error.message}`)
    console.log(`✓ ${table}: ${rows.length} upserted`)

    if (prune) {
      const { data, error: selectError } = await supabase.from(table).select(onConflict)
      if (selectError) throw new Error(`${table} の取得に失敗しました: ${selectError.message}`)
      const dbRows = (data ?? []) as unknown as Record<string, unknown>[]
      const dbKeys = dbRows.map((r) => rowKey(r, keyColumns, table))
      const fileKeys = rows.map((r) => rowKey(r, keyColumns, table))
      const pruneKeys = keysToPrune(fileKeys, dbKeys)
      // 削除の実行前に、対象URL・件数・キー一覧を表示してから DELETE する（非対話のまま）。
      if (pruneKeys.length > 0) {
        console.log(`  prune target: ${url} / ${table} → ${pruneKeys.length} 件削除予定: ${pruneKeys.join(', ')}`)
        if (keyColumns.length === 1) {
          // 単一キーは pruneKeys がそのまま列値なので .in() で一括削除できる。
          const col = keyColumns[0]
          const { error: deleteError } = await supabase.from(table).delete().in(col, pruneKeys)
          if (deleteError) throw new Error(`${table} の削除に失敗しました: ${deleteError.message}`)
        } else {
          // 複合キーは .in() で消せないため、対象行を全キー列一致の .match() で1行ずつ DELETE する。
          const pruneSet = new Set(pruneKeys)
          const pruneRows = dbRows.filter((r) => pruneSet.has(rowKey(r, keyColumns, table)))
          for (const r of pruneRows) {
            const match = Object.fromEntries(keyColumns.map((col) => [col, r[col]]))
            const { error: deleteError } = await supabase.from(table).delete().match(match)
            if (deleteError) throw new Error(`${table} の削除に失敗しました: ${deleteError.message}`)
          }
        }
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
