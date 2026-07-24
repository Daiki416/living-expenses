import type { TaxRate } from './ocr'

// レシート合計アンカーで税込整数を確定する純粋関数群（DB非依存）。
// 税率グループ丸め（distributeByTaxGroup）を基本に、レシート印字合計へ寄せる（distributeToTotal）。
// 端数配分の決定性のため、税額は整数演算（amount*rate%100）で扱い浮動小数の丸め誤差を避ける。

export type ReconcileItem = { amount: number; taxRate: TaxRate }
export type ReconcileStatus = 'match' | 'adjusted' | 'mismatch' | 'noTotal' | 'excluded'
export type ReconcileResult = {
  status: ReconcileStatus
  amounts: number[]      // items と同順の最終税込整数
  computedTotal: number  // グループ丸め総和
  total: number | null
  diff: number | null    // total - computedTotal（アンカー無効時 null）
}

// 税込整数の floor 値。amount は整数前提なので base = amount + floor(amount*rate/100)。
function taxedBase(amount: number, rate: number): number {
  return amount + Math.floor((amount * rate) / 100)
}

// 税込金額の小数部（0..99 の整数）。端数比較用。
function taxedFrac(amount: number, rate: number): number {
  return (amount * rate) % 100
}

// 税率グループごとに丸め、グループ合計を floor(税抜合計*(1+rate/100)) に一致させる。
// rate0 は印字税込をそのまま。戻り値は元の item 順。
export function distributeByTaxGroup(items: ReconcileItem[]): number[] {
  const result = new Array<number>(items.length)
  const groups = new Map<number, number[]>() // taxRate -> 元インデックス配列
  items.forEach((it, i) => {
    const arr = groups.get(it.taxRate)
    if (arr) arr.push(i)
    else groups.set(it.taxRate, [i])
  })
  for (const [rate, indices] of groups) {
    if (rate === 0) {
      for (const i of indices) result[i] = items[i].amount
      continue
    }
    let pretaxSum = 0
    let baseSum = 0
    const entries = indices.map(i => {
      pretaxSum += items[i].amount
      const base = taxedBase(items[i].amount, rate)
      baseSum += base
      return { i, base, frac: taxedFrac(items[i].amount, rate) }
    })
    const target = taxedBase(pretaxSum, rate)
    let remainder = target - baseSum
    // 端数（frac）降順、同値は元インデックス昇順で +1 を配る。
    const order = [...entries].sort((a, b) => b.frac - a.frac || a.i - b.i)
    for (const e of order) {
      if (remainder <= 0) break
      e.base += 1
      remainder -= 1
    }
    for (const e of entries) result[e.i] = e.base
  }
  return result
}

// 課税品目（rate!==0）のみを増減して総和を total に一致させる。rate0 は印字税込で固定。
// 配りきれない場合は null（各品目 >=1 を保つ）。
export function distributeToTotal(items: ReconcileItem[], total: number): number[] | null {
  const result = new Array<number>(items.length)
  const taxable: { i: number; frac: number }[] = []
  let sum = 0
  items.forEach((it, i) => {
    if (it.taxRate === 0) {
      result[i] = it.amount
      sum += it.amount
    } else {
      const base = taxedBase(it.amount, it.taxRate)
      result[i] = base
      sum += base
      taxable.push({ i, frac: taxedFrac(it.amount, it.taxRate) })
    }
  })
  let remainder = total - sum
  if (remainder === 0) return result
  if (remainder > 0) {
    if (remainder > taxable.length) return null
    // frac 降順、同値は元インデックス昇順で +1。
    const order = [...taxable].sort((a, b) => b.frac - a.frac || a.i - b.i)
    for (const e of order) {
      if (remainder <= 0) break
      result[e.i] += 1
      remainder -= 1
    }
    return result
  }
  // remainder < 0: frac 昇順、同値は元インデックス昇順で -1（1円未満になる品目はスキップ）。
  let need = -remainder
  const order = [...taxable].sort((a, b) => a.frac - b.frac || a.i - b.i)
  for (const e of order) {
    if (need <= 0) break
    if (result[e.i] - 1 < 1) continue
    result[e.i] -= 1
    need -= 1
  }
  return need > 0 ? null : result
}

// グループ丸め結果とレシート合計を突合し、必要なら合計へ寄せて status を返す。
export function reconcileReceipt(items: ReconcileItem[], total: number | null, hasExcluded: boolean): ReconcileResult {
  const computed = distributeByTaxGroup(items)
  const computedTotal = computed.reduce((s, a) => s + a, 0)
  if (total == null) {
    return { status: 'noTotal', amounts: computed, computedTotal, total: null, diff: null }
  }
  if (hasExcluded) {
    return { status: 'excluded', amounts: computed, computedTotal, total, diff: null }
  }
  const diff = total - computedTotal
  const taxedCount = items.filter(i => i.taxRate !== 0).length
  if (diff === 0) {
    return { status: 'match', amounts: computed, computedTotal, total, diff: 0 }
  }
  // ずれが課税品目数以内なら合計へ寄せる。寄せられなければ mismatch。
  if (Math.abs(diff) <= taxedCount) {
    const adjusted = distributeToTotal(items, total)
    if (adjusted !== null) {
      return { status: 'adjusted', amounts: adjusted, computedTotal, total, diff }
    }
  }
  return { status: 'mismatch', amounts: computed, computedTotal, total, diff }
}
