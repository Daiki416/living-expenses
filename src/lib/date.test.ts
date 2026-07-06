import { describe, it, expect } from 'vitest'
import { monthDateRange } from './date'

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
