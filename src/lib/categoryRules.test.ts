import { describe, it, expect } from 'vitest'
import { normalizeKeyword, applyRulesToItems } from './categoryRules'
import type { ScanItem } from './ocr'

describe('normalizeKeyword', () => {
  it('全角英数を半角小文字に正規化する', () => {
    expect(normalizeKeyword('Ａ１')).toBe('a1')
  })

  it('半角カナを全角カナに正規化する', () => {
    expect(normalizeKeyword('ﾄﾏﾄ')).toBe('トマト')
  })

  it('前後の空白をトリムする', () => {
    expect(normalizeKeyword('  トマト  ')).toBe('トマト')
  })

  it('連続する空白を1つに畳み込む', () => {
    expect(normalizeKeyword('国産  トマト')).toBe('国産 トマト')
  })

  it('英字を小文字化する', () => {
    expect(normalizeKeyword('Milk')).toBe('milk')
  })

  it('空文字は空文字を返す', () => {
    expect(normalizeKeyword('')).toBe('')
  })

  it('複合的な正規化を行う', () => {
    expect(normalizeKeyword('  Ａ１　 ﾄﾏﾄ  ')).toBe('a1 トマト')
  })
})

function makeItem(overrides: Partial<ScanItem> = {}): ScanItem {
  return { description: 'トマト', amount: 100, selected: true, taxRate: 8, categoryId: null, categoryTouched: false, ...overrides }
}

describe('applyRulesToItems', () => {
  it('一致した品目の categoryId を上書きする（元値より優先）', () => {
    const items = [makeItem({ description: 'トマト', categoryId: 'old' })]
    const rules = new Map([['トマト', 'new']])
    const result = applyRulesToItems(items, rules, new Set(['new']))
    expect(result[0].categoryId).toBe('new')
  })

  it('不一致の品目は不変かつ同一参照を維持する', () => {
    const item = makeItem({ description: '牛乳', categoryId: 'x' })
    const rules = new Map([['トマト', 'new']])
    const result = applyRulesToItems([item], rules, new Set(['new']))
    expect(result[0]).toBe(item)
  })

  it('正規化後にマッチする', () => {
    const items = [makeItem({ description: '  ﾄﾏﾄ  ' })]
    const rules = new Map([['トマト', 'new']])
    const result = applyRulesToItems(items, rules, new Set(['new']))
    expect(result[0].categoryId).toBe('new')
  })

  it('空 description はスキップする（同一参照）', () => {
    const item = makeItem({ description: '   ', categoryId: 'keep' })
    const rules = new Map([['トマト', 'new']])
    const result = applyRulesToItems([item], rules, new Set(['new']))
    expect(result[0]).toBe(item)
  })

  it('マッチしない品目はスキップする（同一参照）', () => {
    const item = makeItem({ description: 'パン', categoryId: 'keep' })
    const rules = new Map<string, string>()
    const result = applyRulesToItems([item], rules, new Set<string>())
    expect(result[0]).toBe(item)
  })

  it('ルールの category_id が有効IDに含まれる場合のみ上書きする', () => {
    const items = [makeItem({ description: 'トマト', categoryId: 'old' })]
    const rules = new Map([['トマト', 'valid']])
    const result = applyRulesToItems(items, rules, new Set(['valid']))
    expect(result[0].categoryId).toBe('valid')
  })

  it('ルールの category_id が有効IDに無い（削除済み）場合は据え置く（同一参照）', () => {
    const item = makeItem({ description: 'トマト', categoryId: 'keep' })
    const rules = new Map([['トマト', 'deleted']])
    const result = applyRulesToItems([item], rules, new Set(['other']))
    expect(result[0]).toBe(item)
  })

  it('ルール適用しても categoryTouched は据え置く（false のまま）', () => {
    const items = [makeItem({ description: 'トマト', categoryTouched: false })]
    const rules = new Map([['トマト', 'new']])
    const result = applyRulesToItems(items, rules, new Set(['new']))
    expect(result[0].categoryTouched).toBe(false)
  })
})
