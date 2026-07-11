import { useEffect, useState } from 'react'
import { supabase, type Expense, type ReceiptKind, type ReceiptWithExpenses } from '../lib/supabase'
import { monthDateRange } from '../lib/date'

export function useReceipts(year: number, month: number) {
  const [receipts, setReceipts] = useState<ReceiptWithExpenses[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const { from, to } = monthDateRange(year, month)

    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('receipts')
        .select('*, expenses(*)')
        .gte('date', from)
        .lt('date', to)
        .order('date', { ascending: false })
      if (cancelled) return
      if (error) {
        setError(error.message)
      } else {
        setReceipts((data as ReceiptWithExpenses[]) ?? [])
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [year, month])

  const expenses = receipts.flatMap(r => r.expenses)

  async function addReceiptGroup(
    receipt: { date: string; description: string; kind: ReceiptKind },
    items: Array<Omit<Expense, 'id' | 'created_at' | 'receipt_id'>>
  ): Promise<void> {
    const { data: receiptData, error: receiptError } = await supabase
      .from('receipts')
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
    const newReceipt: ReceiptWithExpenses = { ...receiptData, expenses: insertedItems }
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
    const { error } = await supabase.from('receipts').delete().eq('id', receiptId)
    if (error) throw new Error(error.message)
    setReceipts(prev => prev.filter(r => r.id !== receiptId))
  }

  async function updateReceipt(
    id: string,
    input: { description: string; date: string; kind: ReceiptKind; paidBy: string | null }
  ): Promise<void> {
    const { description, date, kind, paidBy } = input
    const { error: receiptError } = await supabase
      .from('receipts')
      .update({ description, date, kind })
      .eq('id', id)
    if (receiptError) throw new Error(receiptError.message)
    const { error: expensesError } = await supabase
      .from('expenses')
      .update({ paid_by: paidBy })
      .eq('receipt_id', id)
    if (expensesError) throw new Error(expensesError.message)
    setReceipts(prev => prev.map(r => r.id !== id ? r : {
      ...r,
      description,
      date,
      kind,
      expenses: r.expenses.map(e => ({ ...e, paid_by: paidBy })),
    }))
  }

  return { receipts, expenses, loading, error, addReceiptGroup, updateExpense, deleteReceipt, updateReceipt }
}
