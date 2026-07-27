// 祝日ライブラリはこのファイルだけに隠蔽する。
// 差し替えis1ファイルで完結（他モジュールは isBusinessDay / nextBusinessDay / resolveDebitDate のみ参照）。
import * as holiday_jp from '@holiday-jp/holiday_jp'

// 土日または日本の祝日なら false。
export function isBusinessDay(date: Date): boolean {
  const day = date.getDay()
  if (day === 0 || day === 6) return false
  return !holiday_jp.isHoliday(date)
}

// 渡した日が営業日ならその日、そうでなければ営業日まで1日ずつ進めた新しいDateを返す（非破壊）。
export function nextBusinessDay(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  while (!isBusinessDay(d)) {
    d.setDate(d.getDate() + 1)
  }
  return d
}

// year/month(1-12)/debitDom から引落日を作り、翌営業日に補正して返す。
export function resolveDebitDate(year: number, month: number, debitDom: number): Date {
  return nextBusinessDay(new Date(year, month - 1, debitDom))
}
