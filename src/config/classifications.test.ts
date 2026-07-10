import { describe, it, expect } from 'vitest'
import {
  CLASSIFICATIONS,
  TAX_RATE,
  TAX_RATE_OPTIONS,
  EXPENSE_KIND,
  EXPENSE_KIND_LABEL,
  MEDIA_TYPE,
  MEDIA_TYPE_VALUES,
} from './classifications'

describe('CLASSIFICATIONS', () => {
  it('9 レコードを持つ', () => {
    expect(CLASSIFICATIONS).toHaveLength(9)
  })

  it('value は全て文字列化されている（数値の tax_rate も含む）', () => {
    for (const row of CLASSIFICATIONS) {
      expect(typeof row.value).toBe('string')
    }
    const reduced = CLASSIFICATIONS.find((r) => r.class_name === 'tax_rate' && r.code === 'REDUCED')
    expect(reduced?.value).toBe('8')
  })

  it('sort_order は class ごとに 1 始まりの連番になる', () => {
    const tax = CLASSIFICATIONS.filter((r) => r.class_name === 'tax_rate')
    expect(tax.map((r) => r.sort_order)).toEqual([1, 2, 3])
    const media = CLASSIFICATIONS.filter((r) => r.class_name === 'media_type')
    expect(media.map((r) => r.sort_order)).toEqual([1, 2, 3, 4])
    const kind = CLASSIFICATIONS.filter((r) => r.class_name === 'expense_kind')
    expect(kind.map((r) => r.sort_order)).toEqual([1, 2])
  })

  it('label 未指定（media_type）は null になる', () => {
    const media = CLASSIFICATIONS.filter((r) => r.class_name === 'media_type')
    expect(media.every((r) => r.label === null)).toBe(true)
  })

  it('(class_name, code) は一意である', () => {
    const keys = CLASSIFICATIONS.map((r) => `${r.class_name}:${r.code}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('導出定数', () => {
  it('TAX_RATE は数値でソースの value と一致する', () => {
    expect(TAX_RATE).toEqual({ REDUCED: 8, STANDARD: 10, INCLUSIVE: 0 })
  })

  it('TAX_RATE_OPTIONS は sort_order 順で value/label を持つ', () => {
    expect(TAX_RATE_OPTIONS).toEqual([
      { value: 8, label: '8%' },
      { value: 10, label: '10%' },
      { value: 0, label: '税込' },
    ])
  })

  it('EXPENSE_KIND は業務値と一致する', () => {
    expect(EXPENSE_KIND).toEqual({ ADVANCE: 'advance', CARD: 'card' })
  })

  it('EXPENSE_KIND_LABEL は value→label のマップになる', () => {
    expect(EXPENSE_KIND_LABEL).toEqual({ advance: '立替', card: 'クレカ' })
  })

  it('MEDIA_TYPE / MEDIA_TYPE_VALUES は許可 MIME と一致する', () => {
    expect(MEDIA_TYPE).toEqual({
      JPEG: 'image/jpeg',
      PNG: 'image/png',
      GIF: 'image/gif',
      WEBP: 'image/webp',
    })
    expect(MEDIA_TYPE_VALUES).toEqual(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
  })
})
