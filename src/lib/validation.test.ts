import { describe, it, expect } from 'vitest'
import { parsePositiveInt, sanitizeDate, FORM_ERROR_MESSAGES, toUserErrorMessage } from './validation'

describe('parsePositiveInt', () => {
  it('正の整数文字列を validatedAmount として返す', () => {
    expect(parsePositiveInt('100')).toEqual({ validatedAmount: 100 })
  })
  it('1 は有効', () => {
    expect(parsePositiveInt('1')).toEqual({ validatedAmount: 1 })
  })
  it('0 は null', () => {
    expect(parsePositiveInt('0')).toBeNull()
  })
  it('負数は null', () => {
    expect(parsePositiveInt('-5')).toBeNull()
  })
  it('小数は null', () => {
    expect(parsePositiveInt('1.5')).toBeNull()
  })
  it('空文字は null', () => {
    expect(parsePositiveInt('')).toBeNull()
  })
  it('文字列は null', () => {
    expect(parsePositiveInt('abc')).toBeNull()
  })
})

describe('FORM_ERROR_MESSAGES', () => {
  it('invalidAmount メッセージが定義されている', () => {
    expect(typeof FORM_ERROR_MESSAGES.invalidAmount).toBe('string')
    expect(FORM_ERROR_MESSAGES.invalidAmount.length).toBeGreaterThan(0)
  })
  it('invalidDate メッセージが定義されている', () => {
    expect(typeof FORM_ERROR_MESSAGES.invalidDate).toBe('string')
    expect(FORM_ERROR_MESSAGES.invalidDate.length).toBeGreaterThan(0)
  })
  it('invalidDescription メッセージが定義されている', () => {
    expect(typeof FORM_ERROR_MESSAGES.invalidDescription).toBe('string')
    expect(FORM_ERROR_MESSAGES.invalidDescription.length).toBeGreaterThan(0)
  })
  it('invalidPaidBy メッセージが定義されている', () => {
    expect(typeof FORM_ERROR_MESSAGES.invalidPaidBy).toBe('string')
    expect(FORM_ERROR_MESSAGES.invalidPaidBy.length).toBeGreaterThan(0)
  })
})

describe('parsePositiveInt - 上限チェック', () => {
  it('Number.MAX_SAFE_INTEGER は有効', () => {
    expect(parsePositiveInt(String(Number.MAX_SAFE_INTEGER))).toEqual({ validatedAmount: Number.MAX_SAFE_INTEGER })
  })
  it('Number.MAX_SAFE_INTEGER + 1 は null', () => {
    expect(parsePositiveInt(String(Number.MAX_SAFE_INTEGER + 1))).toBeNull()
  })
})

describe('toUserErrorMessage', () => {
  it('duplicate key エラーは同名存在メッセージを返す', () => {
    const err = new Error('duplicate key value violates unique constraint')
    expect(toUserErrorMessage(err)).toBe('同じ名前がすでに存在します')
  })
  it('その他の Error は汎用メッセージを返す', () => {
    const err = new Error('connection refused')
    expect(toUserErrorMessage(err)).toBe('エラーが発生しました。もう一度お試しください')
  })
  it('string をそのまま渡しても汎用メッセージを返す', () => {
    expect(toUserErrorMessage('some error')).toBe('エラーが発生しました。もう一度お試しください')
  })
  it('null を渡しても汎用メッセージを返す', () => {
    expect(toUserErrorMessage(null)).toBe('エラーが発生しました。もう一度お試しください')
  })
})

describe('sanitizeDate', () => {
  const fallback = '2024-01-01'

  it('有効な日付文字列をそのまま返す', () => {
    expect(sanitizeDate('2024-06-15', fallback)).toBe('2024-06-15')
  })
  it('不正な月（13月）はフォールバックを返す', () => {
    expect(sanitizeDate('2024-13-01', fallback)).toBe(fallback)
  })
  it('不正な月（00月）はフォールバックを返す', () => {
    expect(sanitizeDate('2024-00-01', fallback)).toBe(fallback)
  })
  it('存在しない日付（2月30日）はフォールバックを返す', () => {
    expect(sanitizeDate('2024-02-30', fallback)).toBe(fallback)
  })
  it('存在しない日付（4月31日）はフォールバックを返す', () => {
    expect(sanitizeDate('2024-04-31', fallback)).toBe(fallback)
  })
  it('形式が違う（スラッシュ区切り）はフォールバックを返す', () => {
    expect(sanitizeDate('2024/06/15', fallback)).toBe(fallback)
  })
  it('null はフォールバックを返す', () => {
    expect(sanitizeDate(null, fallback)).toBe(fallback)
  })
  it('undefined はフォールバックを返す', () => {
    expect(sanitizeDate(undefined, fallback)).toBe(fallback)
  })
  it('うるう年の 2/29 は有効', () => {
    expect(sanitizeDate('2024-02-29', fallback)).toBe('2024-02-29')
  })
  it('非うるう年の 2/29 はフォールバックを返す', () => {
    expect(sanitizeDate('2023-02-29', fallback)).toBe(fallback)
  })
})
