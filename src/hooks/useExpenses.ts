import { useEffect, useState } from 'react'
import { supabase, type Expense, type ExpenseReceiptWithExpenses } from '../lib/supabase'
import { monthDateRange } from '../lib/date'

export function useExpenses(year: number, month: number) {
  const [receipts, setReceipts] = useState<ExpenseReceiptWithExpenses[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const { from, to } = monthDateRange(year, month)

    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('expense_receipts')
        .select('*, expenses(*)')
        .gte('date', from)
        .lt('date', to)
        .order('date', { ascending: false })
      if (cancelled) return
      if (error) {
        setError(error.message)
      } else {
        setReceipts((data as ExpenseReceiptWithExpenses[]) ?? [])
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [year, month])

  const expenses = receipts.flatMap(r => r.expenses)

  async function addReceiptGroup(
    receipt: { date: string; description: string },
    items: Array<Omit<Expense, 'id' | 'created_at' | 'receipt_id'>>
  ): Promise<void> {
    const { data: receiptData, error: receiptError } = await supabase
      .from('expense_receipts')
      .insert(receipt)
      .select()
      .single()
    if (receiptError) throw new Error(receiptError.message)
    let insertedItems: Expense[] = []
    if (items.length > 0) {
      const { data: itemsData, error: itemsError } = await supabase
        .from('expenses')
        .insert(items.map(item => ({ ...item, receipt_id: receiptData.id })))
        .select()
      if (itemsError) throw new Error(itemsError.message)
      insertedItems = itemsData ?? []
    }
    const newReceipt: ExpenseReceiptWithExpenses = { ...receiptData, expenses: insertedItems }
    setReceipts(prev => [newReceipt, ...prev])
  }

  async function updateExpense(id: string, input: Omit<Expense, 'id' | 'created_at'>) {
    const { error } = await supabase.from('expenses').update(input).eq('id', id)
    if (error) throw new Error(error.message)
    setReceipts(prev => prev.map(r => {
      if (r.id !== input.receipt_id) return r
      return { ...r, expenses: r.expenses.map(e => e.id === id ? { ...e, ...input } : e) }
    }))
  }

  async function deleteReceipt(receiptId: string) {
    const { error } = await supabase.from('expense_receipts').delete().eq('id', receiptId)
    if (error) throw new Error(error.message)
    setReceipts(prev => prev.filter(r => r.id !== receiptId))
  }

  async function updateReceipt(id: string, input: { description: string; date: string }): Promise<void> {
    const { error } = await supabase
      .from('expense_receipts')
      .update(input)
      .eq('id', id)
    if (error) throw new Error(error.message)
    setReceipts(prev => prev.map(r => r.id !== id ? r : { ...r, ...input }))
  }

  return { receipts, expenses, loading, error, addReceiptGroup, updateExpense, deleteReceipt, updateReceipt }
}
