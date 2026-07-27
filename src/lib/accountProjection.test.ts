import { describe, it, expect } from 'vitest'
import { computeExpectedInflow, computeAccountProjection } from './accountProjection'
import type { Member } from './supabase'

function makeMember(over: Partial<Member> & { name: string; monthly_budget: number }): Member {
  return {
    id: over.id ?? over.name,
    created_at: over.created_at ?? '2026-01-01T00:00:00Z',
    ...over,
  }
}

describe('computeExpectedInflow', () => {
  it('予算が立替を上回る場合は差額を加算する', () => {
    const members = [makeMember({ name: 'A', monthly_budget: 50000 })]
    expect(computeExpectedInflow(members, { A: 20000 })).toBe(30000)
  })

  it('立替が予算を超過する場合は0に丸める', () => {
    const members = [makeMember({ name: 'A', monthly_budget: 50000 })]
    expect(computeExpectedInflow(members, { A: 60000 })).toBe(0)
  })

  it('advanceByName に無いメンバーは予算全額とする', () => {
    const members = [makeMember({ name: 'A', monthly_budget: 50000 })]
    expect(computeExpectedInflow(members, {})).toBe(50000)
  })

  it('予算0は0を寄与する', () => {
    const members = [makeMember({ name: 'A', monthly_budget: 0 })]
    expect(computeExpectedInflow(members, { A: 1000 })).toBe(0)
  })

  it('メンバーが空配列なら0', () => {
    expect(computeExpectedInflow([], {})).toBe(0)
  })

  it('複数メンバーを合算する', () => {
    const members = [
      makeMember({ name: 'A', monthly_budget: 50000 }),
      makeMember({ name: 'B', monthly_budget: 30000 }),
    ]
    expect(computeExpectedInflow(members, { A: 20000, B: 40000 })).toBe(30000)
  })
})

describe('computeAccountProjection', () => {
  it('通常の黒字では shortfall=false', () => {
    expect(computeAccountProjection({ balance: 100000, expectedInflow: 30000, nextCardDebit: 50000 }))
      .toEqual({ beforeDebit: 130000, afterDebit: 80000, shortfall: false })
  })

  it('afterDebit がちょうど0なら shortfall=false', () => {
    expect(computeAccountProjection({ balance: 20000, expectedInflow: 30000, nextCardDebit: 50000 }))
      .toEqual({ beforeDebit: 50000, afterDebit: 0, shortfall: false })
  })

  it('afterDebit が負なら shortfall=true', () => {
    expect(computeAccountProjection({ balance: 10000, expectedInflow: 30000, nextCardDebit: 50000 }))
      .toEqual({ beforeDebit: 40000, afterDebit: -10000, shortfall: true })
  })

  it('未入力扱い（balance=0・nextCardDebit=0）でも計算が成立する', () => {
    expect(computeAccountProjection({ balance: 0, expectedInflow: 0, nextCardDebit: 0 }))
      .toEqual({ beforeDebit: 0, afterDebit: 0, shortfall: false })
  })

  it('負の残高でも計算が成立する', () => {
    expect(computeAccountProjection({ balance: -5000, expectedInflow: 1000, nextCardDebit: 2000 }))
      .toEqual({ beforeDebit: -4000, afterDebit: -6000, shortfall: true })
  })
})
