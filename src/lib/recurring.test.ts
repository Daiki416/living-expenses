import { describe, it, expect } from 'vitest'
import type { Category } from './supabase'
import {
  clampDayToMonth,
  effectiveDateFor,
  nextRegistrationDate,
  validateRecurringTemplate,
  stripEmptyRecurringItems,
  type RecurringTemplateInput,
} from './recurring'

function makeCategory(partial: Partial<Category> & { id: string; name: string; parent_id: string | null }): Category {
  return { sort_order: 0, created_at: '2024-01-01', ...partial }
}

const categories = [
  makeCategory({ id: 'p1', name: '食費', parent_id: null }),
  makeCategory({ id: 'c1', name: '食料品', parent_id: 'p1' }),
  makeCategory({ id: 'p2', name: '日用品', parent_id: null }),
]

function makeInput(partial: Partial<RecurringTemplateInput> = {}): RecurringTemplateInput {
  return {
    description: '家賃',
    kind: 'card',
    paidByMemberId: null,
    dayOfMonth: 27,
    items: [{ description: '家賃', amount: 80000, categoryId: 'c1' }],
    ...partial,
  }
}

describe('clampDayToMonth', () => {
  it('1月に15日はそのまま', () => {
    expect(clampDayToMonth(15, 2026, 1)).toBe(15)
  })
  it('31日指定は平年2月で28にクランプ', () => {
    expect(clampDayToMonth(31, 2026, 2)).toBe(28)
  })
  it('31日指定は閏年2月で29にクランプ', () => {
    expect(clampDayToMonth(31, 2024, 2)).toBe(29)
  })
  it('31日指定は4月で30にクランプ', () => {
    expect(clampDayToMonth(31, 2026, 4)).toBe(30)
  })
  it('31日指定は1月では31のまま', () => {
    expect(clampDayToMonth(31, 2026, 1)).toBe(31)
  })
})

describe('effectiveDateFor', () => {
  it('クランプ不要な日はゼロ埋めの YYYY-MM-DD', () => {
    expect(effectiveDateFor(5, 2026, 3)).toBe('2026-03-05')
  })
  it('末日超えはクランプした日付を返す（平年2月）', () => {
    expect(effectiveDateFor(31, 2026, 2)).toBe('2026-02-28')
  })
})

describe('nextRegistrationDate', () => {
  // 「今日の00:10実行は済み」前提: 指定日==今日でも当日は登録されず翌月になる。
  it('指定日が今日より後（当月内）なら当月のその日', () => {
    expect(nextRegistrationDate(25, { year: 2026, month: 9, day: 21 })).toBe('2026-09-25')
  })
  it('指定日が今日と同じなら翌月（当日実行は済み）', () => {
    expect(nextRegistrationDate(21, { year: 2026, month: 9, day: 21 })).toBe('2026-10-21')
  })
  it('指定日が今日より前なら翌月', () => {
    expect(nextRegistrationDate(10, { year: 2026, month: 9, day: 21 })).toBe('2026-10-10')
  })
  it('12月に今日以前の指定なら翌年1月へ跨ぐ', () => {
    expect(nextRegistrationDate(10, { year: 2026, month: 12, day: 15 })).toBe('2027-01-10')
  })
  it('当月内でも末日超えはクランプする', () => {
    expect(nextRegistrationDate(31, { year: 2026, month: 4, day: 10 })).toBe('2026-04-30')
  })
  it('翌月へ送る場合も末日超えはクランプする（1/31→2月）', () => {
    expect(nextRegistrationDate(31, { year: 2026, month: 1, day: 31 })).toBe('2026-02-28')
  })
})

describe('validateRecurringTemplate', () => {
  it('正常系（クレカ・member未選択）は ok', () => {
    expect(validateRecurringTemplate(makeInput(), categories)).toEqual({ ok: true })
  })
  it('正常系（立替・member選択）は ok', () => {
    expect(validateRecurringTemplate(makeInput({ kind: 'advance', paidByMemberId: 'm1' }), categories)).toEqual({ ok: true })
  })
  it('説明が空（trim後）は ng', () => {
    expect(validateRecurringTemplate(makeInput({ description: '  ' }), categories).ok).toBe(false)
  })
  it('day_of_month が0は ng', () => {
    expect(validateRecurringTemplate(makeInput({ dayOfMonth: 0 }), categories).ok).toBe(false)
  })
  it('day_of_month が32は ng', () => {
    expect(validateRecurringTemplate(makeInput({ dayOfMonth: 32 }), categories).ok).toBe(false)
  })
  it('day_of_month が非整数は ng', () => {
    expect(validateRecurringTemplate(makeInput({ dayOfMonth: 1.5 }), categories).ok).toBe(false)
  })
  it('明細0件は ng', () => {
    expect(validateRecurringTemplate(makeInput({ items: [] }), categories).ok).toBe(false)
  })
  it('明細の説明が空（trim後）は ng', () => {
    expect(validateRecurringTemplate(makeInput({ items: [{ description: '  ', amount: 100, categoryId: null }] }), categories).ok).toBe(false)
  })
  it('amount が負は ng', () => {
    expect(validateRecurringTemplate(makeInput({ items: [{ description: 'x', amount: -1, categoryId: null }] }), categories).ok).toBe(false)
  })
  it('amount が非整数は ng', () => {
    expect(validateRecurringTemplate(makeInput({ items: [{ description: 'x', amount: 1.5, categoryId: null }] }), categories).ok).toBe(false)
  })
  it('amount 0は ng', () => {
    expect(validateRecurringTemplate(makeInput({ items: [{ description: 'x', amount: 0, categoryId: null }] }), categories).ok).toBe(false)
  })
  it('立替で member 未選択は ng', () => {
    expect(validateRecurringTemplate(makeInput({ kind: 'advance', paidByMemberId: null }), categories).ok).toBe(false)
  })
  it('クレカで member 指定は ng', () => {
    expect(validateRecurringTemplate(makeInput({ kind: 'card', paidByMemberId: 'm1' }), categories).ok).toBe(false)
  })
  it('categoryId が葉でない（親どまり）は ng', () => {
    expect(validateRecurringTemplate(makeInput({ items: [{ description: 'x', amount: 1, categoryId: 'p1' }] }), categories).ok).toBe(false)
  })
  it('childless親は葉として ok', () => {
    expect(validateRecurringTemplate(makeInput({ items: [{ description: 'x', amount: 1, categoryId: 'p2' }] }), categories)).toEqual({ ok: true })
  })
  it('categoryId が null は ok', () => {
    expect(validateRecurringTemplate(makeInput({ items: [{ description: 'x', amount: 1, categoryId: null }] }), categories)).toEqual({ ok: true })
  })
})

describe('stripEmptyRecurringItems', () => {
  it('説明も金額も空の行を除外する', () => {
    const items = [
      { description: '家賃', amount: '80000', categoryId: null },
      { description: '', amount: '', categoryId: null },
    ]
    expect(stripEmptyRecurringItems(items)).toEqual([
      { description: '家賃', amount: '80000', categoryId: null },
    ])
  })
  it('説明のみ入力の行は残す', () => {
    const items = [{ description: '家賃', amount: '', categoryId: null }]
    expect(stripEmptyRecurringItems(items)).toEqual(items)
  })
  it('金額のみ入力の行は残す', () => {
    const items = [{ description: '', amount: '100', categoryId: null }]
    expect(stripEmptyRecurringItems(items)).toEqual(items)
  })
  it('全行が空なら空配列（除外後0件→検証で noItems になる）', () => {
    const items = [
      { description: '', amount: '', categoryId: null },
      { description: '  ', amount: '  ', categoryId: null },
    ]
    const remaining = stripEmptyRecurringItems(items)
    expect(remaining).toEqual([])
    const input = makeInput({ items: remaining.map(it => ({ description: it.description.trim(), amount: Number(it.amount), categoryId: it.categoryId })) })
    expect(validateRecurringTemplate(input, categories).ok).toBe(false)
  })
})
