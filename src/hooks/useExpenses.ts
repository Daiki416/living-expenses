import { useEffect, useState } from 'react'
import { supabase, type Expense } from '../lib/supabase'

export function useExpenses(year: number, month: number) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refetchKey, setRefetchKey] = useState(0)

  useEffect(() => {
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    const to = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .gte('date', from)
        .lt('date', to)
        .order('date', { ascending: true })
      if (cancelled) return
      if (error) {
        setError(error.message)
      } else {
        setExpenses(data ?? [])
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [year, month, refetchKey])

  async function addExpense(input: Omit<Expense, 'id' | 'created_at'>) {
    const { error } = await supabase.from('expenses').insert(input)
    if (error) throw new Error(error.message)
    setRefetchKey(k => k + 1)
  }

  async function deleteExpense(id: string) {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setRefetchKey(k => k + 1)
  }

  return { expenses, loading, error, addExpense, deleteExpense }
}
