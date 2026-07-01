import { useEffect, useState } from 'react'
import { supabase, type CardExpense, type CardExpenseReceiptWithCardExpenses } from '../lib/supabase'

export function useCardExpenses(year: number, month: number) {
  const [cardReceipts, setCardReceipts] = useState<CardExpenseReceiptWithCardExpenses[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
  }, [year, month])

  const cardExpenses = cardReceipts.flatMap(r => r.card_expenses)

  async function addCardExpense(input: Omit<CardExpense, 'id' | 'created_at' | 'receipt_id'>) {
    const { data: receiptData, error: receiptError } = await supabase
      .from('card_expense_receipts')
      .insert({ date: input.date, description: input.description })
      .select()
      .single()
    if (receiptError) throw new Error(receiptError.message)
    const { data: expenseData, error: expenseError } = await supabase
      .from('card_expenses')
      .insert({ ...input, receipt_id: receiptData.id })
      .select()
      .single()
    if (expenseError) throw new Error(expenseError.message)
    const newReceipt: CardExpenseReceiptWithCardExpenses = { ...receiptData, card_expenses: [expenseData] }
    setCardReceipts(prev => [newReceipt, ...prev])
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
    let insertedItems: CardExpense[] = []
    if (items.length > 0) {
      const { data: itemsData, error: itemsError } = await supabase
        .from('card_expenses')
        .insert(items.map(item => ({ ...item, receipt_id: receiptData.id })))
        .select()
      if (itemsError) throw new Error(itemsError.message)
      insertedItems = itemsData ?? []
    }
    const newReceipt: CardExpenseReceiptWithCardExpenses = { ...receiptData, card_expenses: insertedItems }
    setCardReceipts(prev => [newReceipt, ...prev])
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
    setCardReceipts(prev => prev.map(r => {
      if (r.id !== input.receipt_id) return r
      const shouldUpdateReceipt = r.card_expenses.length === 1
      return {
        ...r,
        ...(shouldUpdateReceipt ? { date: input.date, description: input.description } : {}),
        card_expenses: r.card_expenses.map(e => e.id === id ? { ...e, ...input } : e),
      }
    }))
  }

  async function deleteCardReceipt(receiptId: string) {
    const { error } = await supabase.from('card_expense_receipts').delete().eq('id', receiptId)
    if (error) throw new Error(error.message)
    setCardReceipts(prev => prev.filter(r => r.id !== receiptId))
  }

  async function updateCardReceiptDescription(id: string, description: string): Promise<void> {
    const { error } = await supabase
      .from('card_expense_receipts')
      .update({ description })
      .eq('id', id)
    if (error) throw new Error(error.message)
    const receipt = cardReceipts.find(r => r.id === id)
    if (receipt && receipt.card_expenses.length === 1) {
      const { error: expenseError } = await supabase
        .from('card_expenses')
        .update({ description })
        .eq('id', receipt.card_expenses[0].id)
      if (expenseError) throw new Error(expenseError.message)
    }
    setCardReceipts(prev => prev.map(r => {
      if (r.id !== id) return r
      const updatedExpenses = r.card_expenses.length === 1
        ? [{ ...r.card_expenses[0], description }]
        : r.card_expenses
      return { ...r, description, card_expenses: updatedExpenses }
    }))
  }

  return { cardReceipts, cardExpenses, loading, error, addCardExpense, addCardReceiptGroup, updateCardExpense, deleteCardReceipt, updateCardReceiptDescription }
}
