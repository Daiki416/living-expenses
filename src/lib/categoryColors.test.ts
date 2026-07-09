import { describe, it, expect } from 'vitest'
import type { Category } from './supabase'
import { resolveCategoryColor } from './categoryColors'
import { CHART_COLORS } from './chartColors'

function cat(id: string, parent_id: string | null, sort_order: number): Category {
  return { id, name: id, parent_id, sort_order, created_at: '2020-01-01' }
}

// 親: p1(sort 0), p2(sort 1) / 子: c1a(親p1), c2a(親p2)
const categories: Category[] = [
  cat('p2', null, 1),
  cat('p1', null, 0),
  cat('c1a', 'p1', 0),
  cat('c1b', 'p1', 1),
  cat('c2a', 'p2', 0),
]

describe('resolveCategoryColor', () => {
  it('子IDは親の色を継承する', () => {
    expect(resolveCategoryColor('c1a', categories)).toBe(CHART_COLORS[0])
    expect(resolveCategoryColor('c2a', categories)).toBe(CHART_COLORS[1])
  })

  it('親直接IDは自分の色を返す', () => {
    expect(resolveCategoryColor('p1', categories)).toBe(CHART_COLORS[0])
    expect(resolveCategoryColor('p2', categories)).toBe(CHART_COLORS[1])
  })

  it('未分類(null)は null を返す', () => {
    expect(resolveCategoryColor(null, categories)).toBeNull()
  })

  it('存在しないIDは null を返す', () => {
    expect(resolveCategoryColor('unknown', categories)).toBeNull()
  })

  it('同じ親なら子が違っても同色', () => {
    expect(resolveCategoryColor('c1a', categories)).toBe(resolveCategoryColor('c1b', categories))
  })

  it('親順は sort_order 昇順で安定（データ並び順に依存しない）', () => {
    // p1(sort0)=色0, p2(sort1)=色1 が入力配列順に関係なく成立
    expect(resolveCategoryColor('p1', categories)).toBe(CHART_COLORS[0])
    expect(resolveCategoryColor('p2', categories)).toBe(CHART_COLORS[1])
  })
})
