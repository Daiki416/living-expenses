/**
 * 指定した年月の月初日と翌月初日を YYYY-MM-DD 形式で返す。
 * Supabase の date 範囲クエリ（gte from / lt to）で月単位の絞り込みに使う。
 */
export function monthDateRange(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const to = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  return { from, to }
}

/**
 * 指定時刻（既定は現在）を JST(UTC+9) に換算し、年・月(1-12)・日を返す。
 * 日本はサマータイムがないため固定オフセットで足りる。ブラウザのタイムゾーンに依存せず
 * 「日本の今日」を求めたいとき（例: 定期登録の次回日プレビュー）に使う。
 */
export function jstDateParts(date: Date = new Date()): { year: number; month: number; day: number } {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  return { year: jst.getUTCFullYear(), month: jst.getUTCMonth() + 1, day: jst.getUTCDate() }
}
