import { useEffect, useState } from 'react'
import { supabase, type CardExpense, type CardExpenseReceiptWithCardExpenses } from '../lib/supabase'
import { monthDateRange } from '../lib/date'

export function useCardExpenses(year: number, month: number) {
  const [cardReceipts, setCardReceipts] = useState<CardExpenseReceiptWithCardExpenses[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const { from, to } = monthDateRange(year, month)

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
    setCardReceipts(prev => prev.map(r => {
      if (r.id !== input.receipt_id) return r
      return { ...r, card_expenses: r.card_expenses.map(e => e.id === id ? { ...e, ...input } : e) }
    }))
  }

  async function deleteCardReceipt(receiptId: string) {
    const { error } = await supabase.from('card_expense_receipts').delete().eq('id', receiptId)
    if (error) throw new Error(error.message)
    setCardReceipts(prev => prev.filter(r => r.id !== receiptId))
  }

  async function updateCardReceipt(id: string, input: { description: string; date: string }): Promise<void> {
    const { error } = await supabase
      .from('card_expense_receipts')
      .update(input)
      .eq('id', id)
    if (error) throw new Error(error.message)
    setCardReceipts(prev => prev.map(r => r.id !== id ? r : { ...r, ...input }))
  }

  return { cardReceipts, cardExpenses, loading, error, addCardReceiptGroup, updateCardExpense, deleteCardReceipt, updateCardReceipt }
}
