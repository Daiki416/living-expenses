import type { Member } from './supabase'

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
