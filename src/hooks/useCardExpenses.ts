import { useEffect, useState } from 'react'
import { supabase, type CardExpense } from '../lib/supabase'

export function useCardExpenses(year: number, month: number) {
  const [cardExpenses, setCardExpenses] = useState<CardExpense[]>([])
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
        .from('card_expenses')
        .select('*')
        .gte('date', from)
        .lt('date', to)
      if (cancelled) return
      if (error) {
        setError(error.message)
      } else {
        setCardExpenses(data ?? [])
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [year, month, refetchKey])

  async function addCardExpense(input: Omit<CardExpense, 'id' | 'created_at'>) {
    const { error } = await supabase.from('card_expenses').insert(input)
    if (error) throw new Error(error.message)
    setRefetchKey(k => k + 1)
  }

  async function addCardExpenseGroup(
    parent: Omit<CardExpense, 'id' | 'created_at'>,
    children: Array<Omit<CardExpense, 'id' | 'created_at' | 'parent_id'>>
  ): Promise<void> {
    const { data: parentData, error: parentError } = await supabase
      .from('card_expenses')
      .insert(parent)
      .select()
      .single()
    if (parentError) throw new Error(parentError.message)
    if (children.length > 0) {
      const { error: childError } = await supabase
        .from('card_expenses')
        .insert(children.map(c => ({ ...c, parent_id: parentData.id })))
      if (childError) throw new Error(childError.message)
    }
    setRefetchKey(k => k + 1)
  }

  async function updateCardExpense(id: string, input: Omit<CardExpense, 'id' | 'created_at'>) {
    const { error } = await supabase.from('card_expenses').update(input).eq('id', id)
    if (error) throw new Error(error.message)
    setRefetchKey(k => k + 1)
  }

  async function deleteCardExpense(id: string) {
    const { error } = await supabase.from('card_expenses').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setRefetchKey(k => k + 1)
  }

  return { cardExpenses, loading, error, addCardExpense, addCardExpenseGroup, updateCardExpense, deleteCardExpense }
}
