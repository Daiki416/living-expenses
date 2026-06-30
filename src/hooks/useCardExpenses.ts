import { useEffect, useState } from 'react'
import { supabase, type CardExpense, type CardExpenseReceiptWithCardExpenses } from '../lib/supabase'

export function useCardExpenses(year: number, month: number) {
  const [cardReceipts, setCardReceipts] = useState<CardExpenseReceiptWithCardExpenses[]>([])
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
        .from('card_expense_receipts')
        .select('*, card_expenses(*)')
        .gte('date', from)
        .lt('date', to)
        .order('date', { ascending: false })
      if (cancelled) return
      if (error) {
        setError(error.message)
      } else {
        setCardReceipts((data as CardExpenseReceiptWithCardExpenses[]) ?? [])
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [year, month, refetchKey])

  const cardExpenses = cardReceipts.flatMap(r => r.card_expenses)

  async function addCardExpense(input: Omit<CardExpense, 'id' | 'created_at' | 'receipt_id'>) {
    const { data: receiptData, error: receiptError } = await supabase
      .from('card_expense_receipts')
      .insert({ date: input.date, description: input.description })
      .select()
      .single()
    if (receiptError) throw new Error(receiptError.message)
    const { error: expenseError } = await supabase
      .from('card_expenses')
      .insert({ ...input, receipt_id: receiptData.id })
    if (expenseError) throw new Error(expenseError.message)
    setRefetchKey(k => k + 1)
  }

  async function addCardReceiptGroup(
    receipt: { date: string; description: string },
    items: Array<Omit<CardExpense, 'id' | 'created_at' | 'receipt_id'>>
  ): Promise<void> {
    const { data: receiptData, error: receiptError } = await supabase
      .from('card_expense_receipts')
      .insert(receipt)
      .select()
      .single()
    if (receiptError) throw new Error(receiptError.message)
    if (items.length > 0) {
      const { error: itemsError } = await supabase
        .from('card_expenses')
        .insert(items.map(item => ({ ...item, receipt_id: receiptData.id })))
      if (itemsError) throw new Error(itemsError.message)
    }
    setRefetchKey(k => k + 1)
  }

  async function updateCardExpense(id: string, input: Omit<CardExpense, 'id' | 'created_at'>) {
    const { error } = await supabase.from('card_expenses').update(input).eq('id', id)
    if (error) throw new Error(error.message)
    const receipt = cardReceipts.find(r => r.id === input.receipt_id)
    if (receipt && receipt.card_expenses.length === 1) {
      const { error: receiptError } = await supabase
        .from('card_expense_receipts')
        .update({ date: input.date, description: input.description })
        .eq('id', input.receipt_id)
      if (receiptError) throw new Error(receiptError.message)
    }
    setRefetchKey(k => k + 1)
  }

  async function deleteCardReceipt(receiptId: string) {
    const { error } = await supabase.from('card_expense_receipts').delete().eq('id', receiptId)
    if (error) throw new Error(error.message)
    setRefetchKey(k => k + 1)
  }

  return { cardReceipts, cardExpenses, loading, error, addCardExpense, addCardReceiptGroup, updateCardExpense, deleteCardReceipt }
}
