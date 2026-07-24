import { describe, it, expect } from 'vitest'
import { distributeByTaxGroup, distributeToTotal, reconcileReceipt } from './receiptTotal'
import type { ReconcileItem } from './receiptTotal'

function item(amount: number, taxRate: ReconcileItem['taxRate']): ReconcileItem {
  return { amount, taxRate }
}

describe('distributeByTaxGroup', () => {
  it('空配列は空配列', () => {
    expect(distributeByTaxGroup([])).toEqual([])
  })

  it('rate0 のみは恒等（印字税込をそのまま）', () => {
    expect(distributeByTaxGroup([item(100, 0), item(200, 0)])).toEqual([100, 200])
  })

  it('単一 8% で remainder0 はそのまま floor', () => {
    // 100*1.08 = 108, target=floor(100*1.08)=108, remainder0
    expect(distributeByTaxGroup([item(100, 8)])).toEqual([108])
  })

  it('[12,13]@8 は端数繰上りで和 = floor(25*1.08)=27', () => {
    // 12→base12(frac0.96) / 13→base14(frac0.04) / target27 / remainder1 → frac降順で先頭に+1
    const result = distributeByTaxGroup([item(12, 8), item(13, 8)])
    expect(result).toEqual([13, 14])
    expect(result.reduce((s, a) => s + a, 0)).toBe(27)
  })

  it('8% と 10% 混在で元の順序を保持する', () => {
    // index0,2 が8%、index1 が10%
    expect(distributeByTaxGroup([item(100, 8), item(100, 10), item(100, 8)])).toEqual([108, 110, 108])
  })

  it('rate0 と課税混在で rate0 は不変', () => {
    expect(distributeByTaxGroup([item(100, 0), item(12, 8), item(13, 8)])).toEqual([100, 13, 14])
  })

  it('端数同値のときは元インデックス昇順で先着する', () => {
    // 5*1.1=5.5 / 15*1.1=16.5 いずれも端数0.5、target=floor(20*1.1)=22、remainder1
    // → 元index昇順で index0 に +1
    expect(distributeByTaxGroup([item(5, 10), item(15, 10)])).toEqual([6, 16])
  })
})

describe('distributeToTotal', () => {
  it('remainder>0 で和が total に一致する', () => {
    const result = distributeToTotal([item(12, 8), item(13, 8)], 27)
    expect(result).toEqual([13, 14])
    expect(result!.reduce((s, a) => s + a, 0)).toBe(27)
  })

  it('remainder0 なら base のまま', () => {
    expect(distributeToTotal([item(12, 8), item(13, 8)], 26)).toEqual([12, 14])
  })

  it('remainder<0 で和が total に一致し各品目 >=1', () => {
    // base[12,14]=26, total25, remainder-1 → frac昇順(item1)を-1
    const result = distributeToTotal([item(12, 8), item(13, 8)], 25)
    expect(result).toEqual([12, 13])
    expect(result!.reduce((s, a) => s + a, 0)).toBe(25)
    expect(result!.every(a => a >= 1)).toBe(true)
  })

  it('1円の課税品目は減算対象からスキップされる', () => {
    // base[1,12]=13, total12, remainder-1 → frac昇順先頭(1円)は<1になるのでskip、次を-1
    expect(distributeToTotal([item(1, 10), item(12, 8)], 12)).toEqual([1, 11])
  })

  it('配れない（全品目1円）ときは null', () => {
    expect(distributeToTotal([item(1, 10), item(1, 10)], 1)).toBe(null)
  })

  it('remainder が課税品目数より大きいときは null', () => {
    expect(distributeToTotal([item(12, 8)], 20)).toBe(null)
  })

  it('rate0 品目は増減対象外（固定される）', () => {
    expect(distributeToTotal([item(100, 0), item(12, 8), item(13, 8)], 127)).toEqual([100, 13, 14])
  })
})

describe('reconcileReceipt', () => {
  it('total=null は noTotal', () => {
    const r = reconcileReceipt([item(12, 8)], null, false)
    expect(r).toEqual({ status: 'noTotal', amounts: [12], computedTotal: 12, total: null, diff: null })
  })

  it('hasExcluded は excluded（diff=null）', () => {
    const r = reconcileReceipt([item(12, 8)], 100, true)
    expect(r).toEqual({ status: 'excluded', amounts: [12], computedTotal: 12, total: 100, diff: null })
  })

  it('diff0 は match', () => {
    const r = reconcileReceipt([item(12, 8), item(13, 8)], 27, false)
    expect(r).toEqual({ status: 'match', amounts: [13, 14], computedTotal: 27, total: 27, diff: 0 })
  })

  it('0<|diff|<=taxedCount は adjusted で Σ==total', () => {
    const r = reconcileReceipt([item(12, 8), item(13, 8)], 28, false)
    expect(r.status).toBe('adjusted')
    expect(r.amounts).toEqual([13, 15])
    expect(r.amounts.reduce((s, a) => s + a, 0)).toBe(28)
    expect(r.diff).toBe(1)
  })

  it('distributeToTotal が null になるときは mismatch', () => {
    // 同一品目2つ@8: computed=[13,12] computedTotal25, total27 diff2(<=2)
    // だが base和24からの remainder3>2 で distributeToTotal は null
    const r = reconcileReceipt([item(12, 8), item(12, 8)], 27, false)
    expect(r.status).toBe('mismatch')
    expect(r.amounts).toEqual([13, 12])
    expect(r.diff).toBe(2)
  })

  it('|diff|>taxedCount は mismatch', () => {
    const r = reconcileReceipt([item(12, 8)], 100, false)
    expect(r).toEqual({ status: 'mismatch', amounts: [12], computedTotal: 12, total: 100, diff: 88 })
  })

  it('taxedCount=0 で diff!=0 は mismatch', () => {
    const r = reconcileReceipt([item(100, 0)], 150, false)
    expect(r).toEqual({ status: 'mismatch', amounts: [100], computedTotal: 100, total: 150, diff: 50 })
  })

  it('空 items + total>0 は mismatch（amounts=[]）', () => {
    const r = reconcileReceipt([], 100, false)
    expect(r).toEqual({ status: 'mismatch', amounts: [], computedTotal: 0, total: 100, diff: 100 })
  })
})
