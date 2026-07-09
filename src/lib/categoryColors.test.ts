import { describe, it, expect } from 'vitest'
import type { Category } from './supabase'
import {
  resolveCategoryColor,
  parentCategoryColor,
  childCategoryColor,
  generalCategoryColor,
  UNCATEGORIZED_COLOR,
} from './categoryColors'

// カンマ区切りの HSL（色相は小数も許容）
const HSL_RE = /^hsl\(\d+(\.\d+)?, \d+%, \d+%\)$/

function cat(id: string, parent_id: string | null, sort_order: number): Category {
  return { id, name: id, parent_id, sort_order, created_at: '2020-01-01' }
}

// 親: p1(sort 0), p2(sort 1) / 子: c1a,c1b(親p1), c2a(親p2)
const categories: Category[] = [
  cat('p2', null, 1),
  cat('p1', null, 0),
  cat('c1a', 'p1', 0),
  cat('c1b', 'p1', 1),
  cat('c2a', 'p2', 0),
]

// H 成分を取り出す
function hue(color: string): number {
  const m = color.match(/^hsl\(([\d.]+),/)
  return m ? Number(m[1]) : NaN
}

// L 成分を取り出す
function lightness(color: string): number {
  const m = color.match(/, (\d+)%\)$/)
  return m ? Number(m[1]) : NaN
}

describe('parentCategoryColor', () => {
  it('親の安定順に対応した色相を返す（p1≠p2）', () => {
    expect(parentCategoryColor('p1', categories)).toMatch(HSL_RE)
    expect(parentCategoryColor('p2', categories)).toMatch(HSL_RE)
    expect(hue(parentCategoryColor('p1', categories))).not.toBe(hue(parentCategoryColor('p2', categories)))
  })

  it('__uncategorized__ はグレーを返す（null は返さない）', () => {
    expect(parentCategoryColor('__uncategorized__', categories)).toBe(UNCATEGORIZED_COLOR)
  })

  it('未知IDはグレーを返す（null は返さない）', () => {
    expect(parentCategoryColor('unknown', categories)).toBe(UNCATEGORIZED_COLOR)
  })

  it('データ並び順に依存せず安定（sort_order基準）', () => {
    const shuffled = [...categories].reverse()
    expect(parentCategoryColor('p1', shuffled)).toBe(parentCategoryColor('p1', categories))
    expect(parentCategoryColor('p2', shuffled)).toBe(parentCategoryColor('p2', categories))
  })
})

describe('childCategoryColor', () => {
  it('同じ親の子は色相または明度が異なる（円グラフで判別可能）', () => {
    const a = childCategoryColor('c1a', categories)
    const b = childCategoryColor('c1b', categories)
    expect(a).toMatch(HSL_RE)
    expect(b).toMatch(HSL_RE)
    expect(a).not.toBe(b)
    expect(hue(a) !== hue(b) || lightness(a) !== lightness(b)).toBe(true)
  })

  it('子の色相は親の色相を中心にずれる（親色相をまたぐ・折り返し考慮）', () => {
    // 色相は円環なので、親色相からの符号付き角度差(-180〜180)で判定する。
    // p1 は h=355 で 0° をまたぐため、単純な大小比較では折り返しを誤判定する。
    const signedDiff = (child: number, parent: number) => ((child - parent + 540) % 360) - 180
    const parentHue = hue(parentCategoryColor('p1', categories))
    const a = signedDiff(hue(childCategoryColor('c1a', categories)), parentHue)
    const b = signedDiff(hue(childCategoryColor('c1b', categories)), parentHue)
    expect(a).toBeLessThan(0)
    expect(b).toBeGreaterThan(0)
  })

  it('子が1件なら親色相の中央（明度も親と同じ）', () => {
    expect(childCategoryColor('c2a', categories)).toBe('hsl(28, 56%, 55%)')
  })

  it('件数を変えても sort_order 基準で安定', () => {
    const shuffled = [...categories].reverse()
    expect(childCategoryColor('c1a', shuffled)).toBe(childCategoryColor('c1a', categories))
  })

  it('未知IDはグレーを返す', () => {
    expect(childCategoryColor('unknown', categories)).toBe(UNCATEGORIZED_COLOR)
  })
})

describe('generalCategoryColor', () => {
  it('親色相・低彩度(18%)を返す', () => {
    const c = generalCategoryColor('p1', categories)
    expect(c).toMatch(HSL_RE)
    expect(hue(c)).toBe(hue(parentCategoryColor('p1', categories)))
    expect(c).toContain('18%')
  })

  it('未知/未分類はグレーを返す', () => {
    expect(generalCategoryColor('__uncategorized__', categories)).toBe(UNCATEGORIZED_COLOR)
    expect(generalCategoryColor('unknown', categories)).toBe(UNCATEGORIZED_COLOR)
  })
})

describe('resolveCategoryColor', () => {
  it('未分類(null)は null を返す', () => {
    expect(resolveCategoryColor(null, categories)).toBeNull()
  })

  it('存在しないIDは null を返す', () => {
    expect(resolveCategoryColor('unknown', categories)).toBeNull()
  })

  it('親でも子でも「親の色」を返す', () => {
    expect(resolveCategoryColor('p1', categories)).toBe(parentCategoryColor('p1', categories))
    expect(resolveCategoryColor('c1a', categories)).toBe(parentCategoryColor('p1', categories))
    expect(resolveCategoryColor('c2a', categories)).toBe(parentCategoryColor('p2', categories))
  })

  it('同じ親なら子が違っても同色', () => {
    expect(resolveCategoryColor('c1a', categories)).toBe(resolveCategoryColor('c1b', categories))
  })

  it('カンマ区切りの HSL 形式を返す', () => {
    expect(resolveCategoryColor('p1', categories)).toMatch(HSL_RE)
  })
})
