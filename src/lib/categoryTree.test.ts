import { describe, it, expect } from 'vitest'
import type { Category } from './supabase'
import {
  leafCategoryIds,
  isLeafCategory,
  shouldDeleteParentAfterChildRemoval,
  validateNewParentWithChild,
} from './categoryTree'

function makeCategory(partial: Partial<Category> & { id: string; name: string; parent_id: string | null }): Category {
  return { sort_order: 0, created_at: '2024-01-01', ...partial }
}

describe('leafCategoryIds', () => {
  it('子を持つ親は含めず、子（葉）のみ含める', () => {
    const categories = [
      makeCategory({ id: 'p1', name: '食費', parent_id: null }),
      makeCategory({ id: 'c1', name: '食料品', parent_id: 'p1' }),
      makeCategory({ id: 'c2', name: '外食', parent_id: 'p1' }),
    ]
    expect(leafCategoryIds(categories)).toEqual(new Set(['c1', 'c2']))
  })

  it('childless親（子を持たない親）は葉として含める', () => {
    const categories = [
      makeCategory({ id: 'p1', name: '食費', parent_id: null }),
      makeCategory({ id: 'c1', name: '食料品', parent_id: 'p1' }),
      makeCategory({ id: 'p2', name: '日用品', parent_id: null }),
    ]
    expect(leafCategoryIds(categories)).toEqual(new Set(['c1', 'p2']))
  })

  it('空配列は空集合', () => {
    expect(leafCategoryIds([])).toEqual(new Set())
  })
})

describe('isLeafCategory', () => {
  const categories = [
    makeCategory({ id: 'p1', name: '食費', parent_id: null }),
    makeCategory({ id: 'c1', name: '食料品', parent_id: 'p1' }),
    makeCategory({ id: 'p2', name: '日用品', parent_id: null }),
  ]

  it('子を持つ親は葉でない', () => {
    expect(isLeafCategory('p1', categories)).toBe(false)
  })
  it('子は葉', () => {
    expect(isLeafCategory('c1', categories)).toBe(true)
  })
  it('childless親は葉', () => {
    expect(isLeafCategory('p2', categories)).toBe(true)
  })
  it('存在しないIDは葉でない', () => {
    expect(isLeafCategory('x', categories)).toBe(false)
  })
})

describe('shouldDeleteParentAfterChildRemoval', () => {
  it('子が2つある親は、1つ削除しても親を削除しない', () => {
    const categories = [
      makeCategory({ id: 'p1', name: '食費', parent_id: null }),
      makeCategory({ id: 'c1', name: '食料品', parent_id: 'p1' }),
      makeCategory({ id: 'c2', name: '外食', parent_id: 'p1' }),
    ]
    expect(shouldDeleteParentAfterChildRemoval(categories, 'c1')).toBeNull()
  })

  it('最後の1子を削除すると親IDを返す', () => {
    const categories = [
      makeCategory({ id: 'p1', name: '食費', parent_id: null }),
      makeCategory({ id: 'c1', name: '食料品', parent_id: 'p1' }),
    ]
    expect(shouldDeleteParentAfterChildRemoval(categories, 'c1')).toBe('p1')
  })

  it('親（parent_id=null）を渡すと null', () => {
    const categories = [
      makeCategory({ id: 'p1', name: '食費', parent_id: null }),
      makeCategory({ id: 'c1', name: '食料品', parent_id: 'p1' }),
    ]
    expect(shouldDeleteParentAfterChildRemoval(categories, 'p1')).toBeNull()
  })

  it('存在しないIDは null', () => {
    const categories = [makeCategory({ id: 'p1', name: '食費', parent_id: null })]
    expect(shouldDeleteParentAfterChildRemoval(categories, 'x')).toBeNull()
  })
})

describe('validateNewParentWithChild', () => {
  it('両名ありは ok', () => {
    expect(validateNewParentWithChild('食費', '食料品')).toEqual({ ok: true })
  })
  it('前後空白は trim して判定する', () => {
    expect(validateNewParentWithChild('  食費  ', '  食料品  ')).toEqual({ ok: true })
  })
  it('親名が空（trim後）は ng', () => {
    expect(validateNewParentWithChild('   ', '食料品').ok).toBe(false)
  })
  it('子名が空（trim後）は ng', () => {
    expect(validateNewParentWithChild('食費', '   ').ok).toBe(false)
  })
  it('親名が100文字超は ng', () => {
    expect(validateNewParentWithChild('a'.repeat(101), '食料品').ok).toBe(false)
  })
  it('子名が100文字超は ng', () => {
    expect(validateNewParentWithChild('食費', 'a'.repeat(101)).ok).toBe(false)
  })
  it('100文字ちょうどは ok', () => {
    expect(validateNewParentWithChild('a'.repeat(100), 'b'.repeat(100))).toEqual({ ok: true })
  })
})
