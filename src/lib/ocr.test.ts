import { describe, it, expect, vi, afterEach } from 'vitest'

// ocr.ts が import する supabase クライアントをモックし、
// テストを環境変数・ネットワーク・Node の WebSocket 実装に依存させない
vi.mock('./supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }))

import { toTaxRate, resolveTaxRate, isValidScanItem, hasValidAmount, toMediaType, applyTax, fileToBase64, isReceiptItem, buildCategoryOptions, resolveCategoryIndex } from './ocr'
import type { ScanItem } from './ocr'
import type { Category } from './supabase'

function makeCategory(partial: Partial<Category> & { id: string; name: string; parent_id: string | null }): Category {
  return { sort_order: 0, created_at: '2024-01-01', ...partial }
}

describe('toTaxRate', () => {
  it('8 をそのまま返す', () => {
    expect(toTaxRate(8)).toBe(8)
  })
  it('10 をそのまま返す', () => {
    expect(toTaxRate(10)).toBe(10)
  })
  it('0 をそのまま返す', () => {
    expect(toTaxRate(0)).toBe(0)
  })
  it('不明な値は 8 にフォールバックする', () => {
    expect(toTaxRate(5)).toBe(8)
  })
})

describe('resolveTaxRate', () => {
  it('8 をそのまま返す', () => {
    expect(resolveTaxRate(8)).toBe(8)
  })
  it('10 をそのまま返す', () => {
    expect(resolveTaxRate(10)).toBe(10)
  })
  it('0 をそのまま返す', () => {
    expect(resolveTaxRate(0)).toBe(0)
  })
  it('範囲外の数値は 8 にフォールバックする', () => {
    expect(resolveTaxRate(5)).toBe(8)
    expect(resolveTaxRate(-1)).toBe(8)
    expect(resolveTaxRate(100)).toBe(8)
  })
  it('NaN は 8 にフォールバックする', () => {
    expect(resolveTaxRate(NaN)).toBe(8)
  })
  it('小数は 8 にフォールバックする', () => {
    expect(resolveTaxRate(8.5)).toBe(8)
  })
  it('null / undefined は 8 にフォールバックする', () => {
    expect(resolveTaxRate(null)).toBe(8)
    expect(resolveTaxRate(undefined)).toBe(8)
  })
  it('文字列の "8" は 8 にフォールバックする', () => {
    expect(resolveTaxRate('8')).toBe(8)
  })
  it('オブジェクトは 8 にフォールバックする', () => {
    expect(resolveTaxRate({})).toBe(8)
  })
})

describe('buildCategoryOptions', () => {
  it('childless親（子を持たない親）は葉として親名 label で出力される', () => {
    const categories = [
      makeCategory({ id: 'p1', name: '食費', parent_id: null }),
      makeCategory({ id: 'p2', name: '日用品', parent_id: null }),
    ]
    expect(buildCategoryOptions(categories)).toEqual([
      { index: 0, label: '食費', id: 'p1' },
      { index: 1, label: '日用品', id: 'p2' },
    ])
  })

  it('子を持つ親は落とし、葉（子）のみを「親 > 子」で親グループ順に並べる', () => {
    const categories = [
      makeCategory({ id: 'p1', name: '食費', parent_id: null }),
      makeCategory({ id: 'c1', name: '食料品', parent_id: 'p1' }),
      makeCategory({ id: 'c2', name: '外食', parent_id: 'p1' }),
      makeCategory({ id: 'p2', name: '日用品', parent_id: null }),
    ]
    expect(buildCategoryOptions(categories)).toEqual([
      { index: 0, label: '食費 > 食料品', id: 'c1' },
      { index: 1, label: '食費 > 外食', id: 'c2' },
      { index: 2, label: '日用品', id: 'p2' },
    ])
  })

  it('index は 0 から連番になる', () => {
    const categories = [
      makeCategory({ id: 'p1', name: 'A', parent_id: null }),
      makeCategory({ id: 'p2', name: 'B', parent_id: null }),
      makeCategory({ id: 'p3', name: 'C', parent_id: null }),
    ]
    expect(buildCategoryOptions(categories).map(o => o.index)).toEqual([0, 1, 2])
  })

  it('50件を超える分は切り捨てる', () => {
    const categories = Array.from({ length: 60 }, (_, i) =>
      makeCategory({ id: `p${i}`, name: `cat${i}`, parent_id: null })
    )
    const options = buildCategoryOptions(categories)
    expect(options).toHaveLength(50)
    expect(options[49].index).toBe(49)
  })
})

describe('resolveCategoryIndex', () => {
  const options = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('範囲内の index は対応する id を返す', () => {
    expect(resolveCategoryIndex(0, options)).toBe('a')
    expect(resolveCategoryIndex(2, options)).toBe('c')
  })
  it('負数は null', () => {
    expect(resolveCategoryIndex(-1, options)).toBe(null)
  })
  it('範囲外は null', () => {
    expect(resolveCategoryIndex(3, options)).toBe(null)
  })
  it('非整数は null', () => {
    expect(resolveCategoryIndex(1.5, options)).toBe(null)
  })
  it('NaN は null', () => {
    expect(resolveCategoryIndex(NaN, options)).toBe(null)
  })
  it('null / undefined は null', () => {
    expect(resolveCategoryIndex(null, options)).toBe(null)
    expect(resolveCategoryIndex(undefined, options)).toBe(null)
  })
  it('空 options は null', () => {
    expect(resolveCategoryIndex(0, [])).toBe(null)
  })
})

describe('isValidScanItem', () => {
  const base: ScanItem = { description: '牛乳', amount: 200, selected: true, taxRate: 8, categoryId: null, categoryTouched: false }

  it('有効なアイテムは true', () => {
    expect(isValidScanItem(base)).toBe(true)
  })
  it('selected が false なら false', () => {
    expect(isValidScanItem({ ...base, selected: false })).toBe(false)
  })
  it('description が空文字なら false', () => {
    expect(isValidScanItem({ ...base, description: '' })).toBe(false)
  })
  it('description がスペースのみなら false', () => {
    expect(isValidScanItem({ ...base, description: '   ' })).toBe(false)
  })
  it('amount が 0 なら false', () => {
    expect(isValidScanItem({ ...base, amount: 0 })).toBe(false)
  })
  it('amount が負数なら false', () => {
    expect(isValidScanItem({ ...base, amount: -1 })).toBe(false)
  })
  it('amount が小数なら false', () => {
    expect(isValidScanItem({ ...base, amount: 1.5 })).toBe(false)
  })
})

describe('hasValidAmount', () => {
  it('正の整数は true', () => {
    expect(hasValidAmount(200)).toBe(true)
    expect(hasValidAmount(1)).toBe(true)
  })
  it('null は false', () => {
    expect(hasValidAmount(null)).toBe(false)
  })
  it('0 は false', () => {
    expect(hasValidAmount(0)).toBe(false)
  })
  it('負数は false', () => {
    expect(hasValidAmount(-1)).toBe(false)
  })
  it('小数は false', () => {
    expect(hasValidAmount(1.5)).toBe(false)
  })
})

describe('applyTax', () => {
  it('8% の場合は税込金額を Math.floor で返す', () => {
    expect(applyTax(100, 8)).toBe(108)
  })
  it('10% の場合は税込金額を Math.floor で返す', () => {
    expect(applyTax(100, 10)).toBe(110)
  })
  it('0% の場合は金額をそのまま返す（スキップ）', () => {
    expect(applyTax(100, 0)).toBe(100)
  })
  it('端数は切り捨てる（8%: 101円）', () => {
    // 101 * 1.08 = 109.08 → 109
    expect(applyTax(101, 8)).toBe(109)
  })
  it('端数は切り捨てる（10%: 99円）', () => {
    // 99 * 1.1 = 108.9 → 108
    expect(applyTax(99, 10)).toBe(108)
  })
})

describe('fileToBase64', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('5MB 超のファイルはサイズエラーで reject する', async () => {
    const largeFile = new File([new ArrayBuffer(5 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' })
    await expect(fileToBase64(largeFile)).rejects.toThrow('画像ファイルは5MB以下にしてください')
  })

  it('onerror 時は「画像の読み込みに失敗しました」というメッセージの Error で reject する', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function MockFileReader(this: any) {
      this.onload = null
      this.onerror = null
      this.result = null
      this.readAsDataURL = () => {
        // onerror ハンドラを非同期で呼び出す（ProgressEvent 相当の引数を渡す）
        // 実装側は onerror の引数を無視して new Error('画像の読み込みに失敗しました') で reject する
        Promise.resolve().then(() => {
          if (this.onerror) {
            this.onerror({ type: 'error' })
          }
        })
      }
    }

    vi.stubGlobal('FileReader', MockFileReader)

    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' })
    const promise = fileToBase64(file)
    await expect(promise).rejects.toThrow('画像の読み込みに失敗しました')
  })
})

describe('isReceiptItem', () => {
  it('有効なオブジェクトは true', () => {
    expect(isReceiptItem({ description: '牛乳', amount: 200 })).toBe(true)
  })
  it('null は false', () => {
    expect(isReceiptItem(null)).toBe(false)
  })
  it('description が空文字は false', () => {
    expect(isReceiptItem({ description: '', amount: 200 })).toBe(false)
  })
  it('description が 200 文字を超えると false', () => {
    expect(isReceiptItem({ description: 'a'.repeat(201), amount: 200 })).toBe(false)
  })
  it('description が 200 文字ちょうどは true', () => {
    expect(isReceiptItem({ description: 'a'.repeat(200), amount: 200 })).toBe(true)
  })
  it('amount が 0 は false', () => {
    expect(isReceiptItem({ description: '牛乳', amount: 0 })).toBe(false)
  })
  it('amount が負数は false', () => {
    expect(isReceiptItem({ description: '牛乳', amount: -1 })).toBe(false)
  })
  it('amount が Infinity は false', () => {
    expect(isReceiptItem({ description: '牛乳', amount: Infinity })).toBe(false)
  })
  it('amount が NaN は false', () => {
    expect(isReceiptItem({ description: '牛乳', amount: NaN })).toBe(false)
  })
  it('description が数値は false', () => {
    expect(isReceiptItem({ description: 123, amount: 200 })).toBe(false)
  })
  it('amount が文字列は false', () => {
    expect(isReceiptItem({ description: '牛乳', amount: '200' })).toBe(false)
  })
})

describe('toMediaType', () => {
  it('image/jpeg を許可する', () => {
    expect(toMediaType('image/jpeg')).toBe('image/jpeg')
  })
  it('image/png を許可する', () => {
    expect(toMediaType('image/png')).toBe('image/png')
  })
  it('image/gif を許可する', () => {
    expect(toMediaType('image/gif')).toBe('image/gif')
  })
  it('image/webp を許可する', () => {
    expect(toMediaType('image/webp')).toBe('image/webp')
  })
  it('許可リスト外はエラーをスローする', () => {
    expect(() => toMediaType('image/bmp')).toThrow()
  })
  it('application/pdf はエラーをスローする', () => {
    expect(() => toMediaType('application/pdf')).toThrow()
  })
})
