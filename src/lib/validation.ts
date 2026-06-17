export const FORM_ERROR_MESSAGES = {
  invalidAmount: '金額は1以上の整数で入力してください',
  invalidDate: '日付を入力してください',
  invalidDescription: '内容を入力してください',
  invalidPaidBy: '支払者を選択してください',
} as const

/**
 * 文字列を正の整数にパースする。
 * 成功すれば { validatedAmount: number } を、失敗すれば null を返す。
 */
export function parsePositiveInt(value: string): { validatedAmount: number } | null {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > Number.MAX_SAFE_INTEGER) return null
  return { validatedAmount: parsed }
}

/**
 * エラーを受け取り、ユーザーに表示しても安全なメッセージを返す。
 * Supabase の内部エラーメッセージが surface されないよう変換する。
 */
export function toUserErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.includes('duplicate key')) {
    return '同じ名前がすでに存在します'
  }
  return 'エラーが発生しました。もう一度お試しください'
}

const STRICT_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

/**
 * 日付文字列を検証する。
 * YYYY-MM-DD 形式かつ実在する日付であれば raw を返し、そうでなければ fallback を返す。
 */
export function sanitizeDate(raw: string | null | undefined, fallback: string): string {
  if (typeof raw !== 'string') return fallback
  if (!STRICT_DATE_PATTERN.test(raw)) return fallback
  const date = new Date(raw)
  if (isNaN(date.getTime())) return fallback
  // new Date('2024-02-30') は月をまたいで繰り上がるため、元の月と一致するか確認する
  const [, month] = raw.split('-').map(Number)
  if (date.getUTCMonth() + 1 !== month) return fallback
  return raw
}
