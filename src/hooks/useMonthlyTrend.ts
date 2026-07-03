import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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
    const nextM = em === 12 ? 1 : em + 1
    const nextY = em === 12 ? ey + 1 : ey
    const to = `${nextY}-${String(nextM).padStart(2, '0')}-01`

    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)

      const [expenseRes, cardRes] = await Promise.all([
        supabase
          .from('expense_receipts')
          .select('date, expenses(amount, category_id)')
          .gte('date', from)
          .lt('date', to),
        supabase
          .from('card_expense_receipts')
          .select('date, card_expenses(amount, category_id)')
          .gte('date', from)
          .lt('date', to),
      ])

      if (cancelled) return

      if (expenseRes.error) {
        setError(expenseRes.error.message)
        setLoading(false)
        return
      }
      if (cardRes.error) {
        setError(cardRes.error.message)
        setLoading(false)
        return
      }

      const totalsMap: Record<string, Record<string, number>> = {}

      const addToMap = (ym: string, categoryId: string | null, amount: number) => {
        if (!totalsMap[ym]) totalsMap[ym] = {}
        const key = categoryId ?? '__uncategorized__'
        totalsMap[ym][key] = (totalsMap[ym][key] ?? 0) + amount
      }

      for (const row of expenseRes.data ?? []) {
        const ym = row.date.slice(0, 7)
        for (const e of (row.expenses as { amount: number; category_id: string | null }[])) {
          addToMap(ym, e.category_id, e.amount)
        }
      }

      for (const row of cardRes.data ?? []) {
        const ym = row.date.slice(0, 7)
        for (const e of (row.card_expenses as { amount: number; category_id: string | null }[])) {
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
