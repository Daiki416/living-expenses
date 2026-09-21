import { describe, it, expect } from 'vitest'
import { monthDateRange, jstDateParts } from './date'

describe('monthDateRange', () => {
  it('通常月は月初と翌月初を返す', () => {
    expect(monthDateRange(2026, 7)).toEqual({ from: '2026-07-01', to: '2026-08-01' })
  })
  it('1桁の月はゼロ埋めされる', () => {
    expect(monthDateRange(2026, 1)).toEqual({ from: '2026-01-01', to: '2026-02-01' })
  })
  it('12月は翌年1月にまたがる', () => {
    expect(monthDateRange(2025, 12)).toEqual({ from: '2025-12-01', to: '2026-01-01' })
  })
})

describe('jstDateParts', () => {
  it('UTC+9で日付が翌日に繰り上がる', () => {
    // 2026-09-21T16:00:00Z = JST 2026-09-22 01:00
    expect(jstDateParts(new Date('2026-09-21T16:00:00Z'))).toEqual({ year: 2026, month: 9, day: 22 })
  })
  it('JSTで日付が変わらない時刻はそのまま', () => {
    // 2026-09-21T14:59:00Z = JST 2026-09-21 23:59
    expect(jstDateParts(new Date('2026-09-21T14:59:00Z'))).toEqual({ year: 2026, month: 9, day: 21 })
  })
  it('年跨ぎ（UTC大晦日→JST元日）を正しく扱う', () => {
    // 2026-12-31T15:30:00Z = JST 2027-01-01 00:30
    expect(jstDateParts(new Date('2026-12-31T15:30:00Z'))).toEqual({ year: 2027, month: 1, day: 1 })
  })
})
