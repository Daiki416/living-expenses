import { useEffect, useState } from 'react'
import { supabase, type Expense, type ExpenseReceiptWithExpenses } from '../lib/supabase'

export function useExpenses(year: number, month: number) {
  const [receipts, setReceipts] = useState<ExpenseReceiptWithExpenses[]>([])
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
  }, [year, month, refetchKey])

  const expenses = receipts.flatMap(r => r.expenses)

  async function addExpense(input: Omit<Expense, 'id' | 'created_at' | 'receipt_id'>) {
    const { data: receiptData, error: receiptError } = await supabase
      .from('expense_receipts')
      .insert({ date: input.date, description: input.description })
      .select()
      .single()
    if (receiptError) throw new Error(receiptError.message)
    const { error: expenseError } = await supabase
      .from('expenses')
      .insert({ ...input, receipt_id: receiptData.id })
    if (expenseError) throw new Error(expenseError.message)
    setRefetchKey(k => k + 1)
  }

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
    if (items.length > 0) {
      const { error: itemsError } = await supabase
        .from('expenses')
        .insert(items.map(item => ({ ...item, receipt_id: receiptData.id })))
      if (itemsError) throw new Error(itemsError.message)
    }
    setRefetchKey(k => k + 1)
  }

  async function updateExpense(id: string, input: Omit<Expense, 'id' | 'created_at'>) {
    const { error } = await supabase.from('expenses').update(input).eq('id', id)
    if (error) throw new Error(error.message)
    const receipt = receipts.find(r => r.id === input.receipt_id)
    if (receipt && receipt.expenses.length === 1) {
      const { error: receiptError } = await supabase
        .from('expense_receipts')
        .update({ date: input.date, description: input.description })
        .eq('id', input.receipt_id)
      if (receiptError) throw new Error(receiptError.message)
    }
    setRefetchKey(k => k + 1)
  }

  async function deleteReceipt(receiptId: string) {
    const { error } = await supabase.from('expense_receipts').delete().eq('id', receiptId)
    if (error) throw new Error(error.message)
    setRefetchKey(k => k + 1)
  }

  return { receipts, expenses, loading, error, addExpense, addReceiptGroup, updateExpense, deleteReceipt }
}
