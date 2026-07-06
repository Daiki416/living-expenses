import { describe, it, expect } from 'vitest'
import { computeSortOrderUpdates } from './categoryOrder'

describe('computeSortOrderUpdates', () => {
  it('空配列は空配列を返す', () => {
    expect(computeSortOrderUpdates([])).toEqual([])
  })

  it('全件を index 通りの sort_order に割り当てる', () => {
    expect(computeSortOrderUpdates(['a', 'b', 'c'])).toEqual([
      { id: 'a', sort_order: 0 },
      { id: 'b', sort_order: 1 },
      { id: 'c', sort_order: 2 },
    ])
  })

  it('単一要素は sort_order 0', () => {
    expect(computeSortOrderUpdates(['x'])).toEqual([{ id: 'x', sort_order: 0 }])
  })

  it('入力順がそのまま sort_order 昇順になる', () => {
    expect(computeSortOrderUpdates(['c', 'a', 'b'])).toEqual([
      { id: 'c', sort_order: 0 },
      { id: 'a', sort_order: 1 },
      { id: 'b', sort_order: 2 },
    ])
  })
})
