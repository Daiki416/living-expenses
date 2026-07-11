import { describe, it, expect } from 'vitest'
import { deriveReceiptKind } from './payment'
import { EXPENSE_KIND } from '../config/classifications'

describe('deriveReceiptKind', () => {
  it('null はクレカ', () => {
    expect(deriveReceiptKind(null)).toBe(EXPENSE_KIND.CARD)
  })
  it('メンバー名は立替', () => {
    expect(deriveReceiptKind('夫')).toBe(EXPENSE_KIND.ADVANCE)
  })
  it('空文字は falsy なのでクレカ', () => {
    expect(deriveReceiptKind('')).toBe(EXPENSE_KIND.CARD)
  })
})
