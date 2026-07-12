import { describe, it, expect } from 'vitest'
import { deriveReceiptKind } from './payment'
import { EXPENSE_KIND } from '../config/classifications'

describe('deriveReceiptKind', () => {
  it('null（メンバーID未指定）はクレカ', () => {
    expect(deriveReceiptKind(null)).toBe(EXPENSE_KIND.CARD)
  })
  it('メンバーIDありは立替', () => {
    expect(deriveReceiptKind('11111111-1111-1111-1111-111111111111')).toBe(EXPENSE_KIND.ADVANCE)
  })
  it('空文字は falsy なのでクレカ', () => {
    expect(deriveReceiptKind('')).toBe(EXPENSE_KIND.CARD)
  })
})
