import { describe, it, expect, vi, afterEach } from 'vitest'
import { toTaxRate, isValidScanItem, toMediaType, applyTax, fileToBase64, isReceiptItem } from './ocr'
import type { ScanItem } from './ocr'

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

describe('isValidScanItem', () => {
  const base: ScanItem = { description: '牛乳', amount: 200, selected: true, taxRate: 8 }

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
