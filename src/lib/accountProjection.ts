import type { Member } from './supabase'
import { resolveDebitDate } from './businessDay'

// 「今日」から見て次に来る実引落日と、その引落を賄う振込がどちらの月基準かを返す。
// today <  今月の補正後引落日 → 次引落は今月。振込は先月立替を差し引いた額（月初1〜3日に着金）。
// today >= 今月の補正後引落日 → 次引落は来月。振込は今月立替を差し引いた額。
//   （引落日当日は「もう引き落とされた」とみなし来月扱いにする。表示切り替え日と引落日を一致させるため。）
export function resolveUpcomingDebit(
  today: Date,
  debitDom: number,
): { debitDate: Date; usePrevMonthAdvances: boolean } {
  const y = today.getFullYear()
  const m = today.getMonth() + 1 // 1-12
  const thisMonthDebit = resolveDebitDate(y, m, debitDom)
  const key = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
  if (key(today) < key(thisMonthDebit)) {
    return { debitDate: thisMonthDebit, usePrevMonthAdvances: true }
  }
  const ny = m === 12 ? y + 1 : y
  const nm = m === 12 ? 1 : m + 1
  return { debitDate: resolveDebitDate(ny, nm, debitDom), usePrevMonthAdvances: false }
}

// C = 翌月の入金見込み。各メンバーの月予算から当月立替を差し引いた額（負なら0）の総和。
export function computeExpectedInflow(
  members: Member[],
  advanceByMemberName: Record<string, number>,
): number {
  return members.reduce(
    (s, m) => s + Math.max(0, m.monthly_budget - (advanceByMemberName[m.name] ?? 0)),
    0,
  )
}

export function computeAccountProjection(input: {
  balance: number
  expectedInflow: number
  nextCardDebit: number
}): { beforeDebit: number; afterDebit: number; shortfall: boolean } {
  const beforeDebit = input.balance + input.expectedInflow
  const afterDebit = beforeDebit - input.nextCardDebit
  return { beforeDebit, afterDebit, shortfall: afterDebit < 0 }
}
