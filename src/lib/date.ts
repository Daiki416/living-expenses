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
