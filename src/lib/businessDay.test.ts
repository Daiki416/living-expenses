import { describe, it, expect } from 'vitest'
import { isBusinessDay, nextBusinessDay, resolveDebitDate } from './businessDay'

// 祝日ライブラリはモックせず実挙動で検証する。
describe('isBusinessDay', () => {
  it('平日はtrue（2026-01-05 月曜）', () => {
    expect(isBusinessDay(new Date(2026, 0, 5))).toBe(true)
  })

  it('土曜はfalse（2026-01-10）', () => {
    expect(isBusinessDay(new Date(2026, 0, 10))).toBe(false)
  })

  it('日曜はfalse（2026-01-11）', () => {
    expect(isBusinessDay(new Date(2026, 0, 11))).toBe(false)
  })

  it('祝日 元日 1/1 はfalse', () => {
    expect(isBusinessDay(new Date(2026, 0, 1))).toBe(false)
  })

  it('ハッピーマンデー 成人の日（2026-01-12 第2月曜）はfalse', () => {
    expect(isBusinessDay(new Date(2026, 0, 12))).toBe(false)
  })

  it('春分の日（2026-03-20）はfalse', () => {
    expect(isBusinessDay(new Date(2026, 2, 20))).toBe(false)
  })
})

describe('nextBusinessDay', () => {
  it('営業日はその日を返す', () => {
    expect(nextBusinessDay(new Date(2026, 0, 5))).toEqual(new Date(2026, 0, 5))
  })

  it('土曜→翌月曜（2026-01-10→01-12ではなく成人の日を跨ぐので01-13）', () => {
    // 1/10土 → 1/11日 → 1/12成人の日 → 1/13火（最初の営業日）
    expect(nextBusinessDay(new Date(2026, 0, 10))).toEqual(new Date(2026, 0, 13))
  })

  it('日曜→翌月曜（2026-01-18日→01-19月）', () => {
    expect(nextBusinessDay(new Date(2026, 0, 18))).toEqual(new Date(2026, 0, 19))
  })

  it('年末年始の連続休（2026-01-01木）→最初の営業日 01-05月', () => {
    // 1/1木(祝) 1/2金(平日) 実は1/2は営業日
    expect(nextBusinessDay(new Date(2026, 0, 1))).toEqual(new Date(2026, 0, 2))
  })

  it('引数を破壊しない', () => {
    const d = new Date(2026, 0, 10)
    nextBusinessDay(d)
    expect(d).toEqual(new Date(2026, 0, 10))
  })
})

describe('resolveDebitDate', () => {
  it('平日の指定日はそのまま', () => {
    expect(resolveDebitDate(2026, 1, 5)).toEqual(new Date(2026, 0, 5))
  })

  it('土日祝は翌営業日に補正', () => {
    // 2026-01-10は土曜→01-13
    expect(resolveDebitDate(2026, 1, 10)).toEqual(new Date(2026, 0, 13))
  })

  it('12月境界（monthは1-12）', () => {
    expect(resolveDebitDate(2026, 12, 4)).toEqual(new Date(2026, 11, 4))
  })
})
