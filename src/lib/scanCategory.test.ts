import { describe, it, expect } from 'vitest'
import { resolveScanItemCategoryId } from './scanCategory'

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
