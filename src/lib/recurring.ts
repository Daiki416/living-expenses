import type { Category, ReceiptKind } from './supabase'
import { isLeafCategory } from './categoryTree'
import { MESSAGES } from '../config/messages'

// day-of-month を対象月の日数へクランプする（month は 1-12）。
// 31日指定でも 2月は 28/29、4月は 30 に丸め、その月に存在する日へ寄せる。
export function clampDayToMonth(dom: number, year: number, month: number): number {
  // JS の月インデックスは 0 始まり。new Date(year, month, 0) は「month（0始まり）の前月末日」＝
  // 1始まり month の末日を返す（例: month=2 → 2月末日）。
  const lastDay = new Date(year, month, 0).getDate()
  return Math.min(dom, lastDay)
}

// 対象月における実登録日を 'YYYY-MM-DD' で返す（末日超えはクランプ）。
export function effectiveDateFor(dom: number, year: number, month: number): string {
  const day = clampDayToMonth(dom, year, month)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// 次に自動登録される日を 'YYYY-MM-DD' で返す（表示用プレビュー）。
// cron は毎日 JST 00:10 に1回だけ走り、その日が対象日のときのみ登録する。
// よって「今日の00:10実行は既に済み」前提で、当月クランプ日が今日より後なら当月、
// 今日以前（==今日を含む）なら翌月（年跨ぎ考慮）を返す。末日超えは clampDayToMonth で寄せる。
export function nextRegistrationDate(
  dayOfMonth: number,
  today: { year: number; month: number; day: number },
): string {
  const clamped = clampDayToMonth(dayOfMonth, today.year, today.month)
  if (clamped > today.day) return effectiveDateFor(dayOfMonth, today.year, today.month)
  const nextMonth = today.month === 12 ? 1 : today.month + 1
  const nextYear = today.month === 12 ? today.year + 1 : today.year
  return effectiveDateFor(dayOfMonth, nextYear, nextMonth)
}

export type RecurringItemInput = {
  description: string
  amount: number
  categoryId: string | null
}

export type RecurringTemplateInput = {
  description: string
  kind: ReceiptKind
  paidByMemberId: string | null
  dayOfMonth: number
  items: RecurringItemInput[]
}

export type RecurringValidation = { ok: true } | { ok: false; message: string }

// 定期テンプレートの入力を検証する。カテゴリーは葉（小分類）または未分類のみ許可する。
export function validateRecurringTemplate(
  input: RecurringTemplateInput,
  categories: Category[],
): RecurringValidation {
  if (!input.description.trim()) return { ok: false, message: MESSAGES.recurring.invalidDescription }
  if (!Number.isInteger(input.dayOfMonth) || input.dayOfMonth < 1 || input.dayOfMonth > 31) {
    return { ok: false, message: MESSAGES.recurring.invalidDayOfMonth }
  }
  if (input.kind === 'advance' && !input.paidByMemberId) {
    return { ok: false, message: MESSAGES.recurring.invalidPaidBy }
  }
  if (input.kind === 'card' && input.paidByMemberId) {
    return { ok: false, message: MESSAGES.recurring.cardWithMember }
  }
  if (input.items.length === 0) return { ok: false, message: MESSAGES.recurring.noItems }
  for (const item of input.items) {
    if (!item.description.trim()) {
      return { ok: false, message: MESSAGES.recurring.invalidItemDescription }
    }
    if (!Number.isInteger(item.amount) || item.amount <= 0) {
      return { ok: false, message: MESSAGES.recurring.invalidAmount }
    }
    if (item.categoryId && !isLeafCategory(item.categoryId, categories)) {
      return { ok: false, message: MESSAGES.recurring.invalidCategory }
    }
  }
  return { ok: true }
}

// 説明も金額も未入力の明細行を除外する（末尾の空行で検証を弾かないため）。
// 検証・保存前のフォーム入力（金額は文字列ドラフト）に対して使う。
export function stripEmptyRecurringItems<T extends { description: string; amount: string }>(items: T[]): T[] {
  return items.filter((it) => it.description.trim() !== '' || it.amount.trim() !== '')
}
