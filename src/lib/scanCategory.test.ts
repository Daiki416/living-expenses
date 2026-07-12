import { describe, it, expect } from 'vitest'
import { resolveCommonCategoryId, resolveScanItemCategoryId } from './scanCategory'

describe('resolveCommonCategoryId', () => {
  it('子カテゴリーを優先する', () => {
    expect(resolveCommonCategoryId('parent-1', 'child-1')).toBe('child-1')
  })

  it('子が空なら親を返す', () => {
    expect(resolveCommonCategoryId('parent-1', '')).toBe('parent-1')
  })

  it('親子とも空なら null を返す', () => {
    expect(resolveCommonCategoryId('', '')).toBeNull()
  })
})

describe('resolveScanItemCategoryId', () => {
  it('共通モードONなら共通カテゴリーを返す（明細の個別値は無視）', () => {
    expect(resolveScanItemCategoryId(true, 'common-1', 'item-1')).toBe('common-1')
  })

  it('共通モードONで共通カテゴリーが null ならそのまま null', () => {
    expect(resolveScanItemCategoryId(true, null, 'item-1')).toBeNull()
  })

  it('共通モードOFFなら明細の個別カテゴリーを返す', () => {
    expect(resolveScanItemCategoryId(false, 'common-1', 'item-1')).toBe('item-1')
  })

  it('共通モードOFFで個別カテゴリーが null ならそのまま null', () => {
    expect(resolveScanItemCategoryId(false, 'common-1', null)).toBeNull()
  })
})
