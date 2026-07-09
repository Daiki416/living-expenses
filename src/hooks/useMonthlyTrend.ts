import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { monthDateRange } from '../lib/date'

export type MonthlyPoint = {
  ym: string
  label: string
  totals: Record<string, number>
}

function enumerateMonths(startYM: string, endYM: string): string[] {
  const months: string[] = []
  let [y, m] = startYM.split('-').map(Number)
  const [ey, em] = endYM.split('-').map(Number)
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`)
    if (m === 12) { y++; m = 1 } else { m++ }
  }
  return months
}

export function useMonthlyTrend(startYM: string, endYM: string) {
  const [monthlyData, setMonthlyData] = useState<MonthlyPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const from = `${startYM}-01`
    const [ey, em] = endYM.split('-').map(Number)
    const { to } = monthDateRange(ey, em)

    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('receipts')
        .select('date, expenses(amount, category_id)')
        .gte('date', from)
        .lt('date', to)

      if (cancelled) return

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      const totalsMap: Record<string, Record<string, number>> = {}

      const addToMap = (ym: string, categoryId: string | null, amount: number) => {
        if (!totalsMap[ym]) totalsMap[ym] = {}
        const key = categoryId ?? '__uncategorized__'
        totalsMap[ym][key] = (totalsMap[ym][key] ?? 0) + amount
      }

      for (const row of data ?? []) {
        const ym = row.date.slice(0, 7)
        for (const e of (row.expenses as { amount: number; category_id: string | null }[])) {
          addToMap(ym, e.category_id, e.amount)
        }
      }

      const months = enumerateMonths(startYM, endYM)
      const points: MonthlyPoint[] = months.map(ym => ({
        ym,
        label: `${Number(ym.split('-')[1])}月`,
        totals: totalsMap[ym] ?? {},
      }))

      setMonthlyData(points)
      setLoading(false)
    })()

    return () => { cancelled = true }
  }, [startYM, endYM])

  return { monthlyData, loading, error }
}
