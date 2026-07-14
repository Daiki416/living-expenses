import { describe, it, expect } from 'vitest'
import { filterReceiptsByPayer, collectExpensesByCategory } from './expenseFilter'
import type { ReceiptWithExpenses, Expense } from './supabase'

function makeExpense(over: Partial<Expense> & { id: string; category_id: string | null; receipt_id: string }): Expense {
  return {
    description: over.description ?? 'item',
    amount: over.amount ?? 100,
    created_at: over.created_at ?? '2026-01-01T00:00:00Z',
    ...over,
  }
}

function makeReceipt(over: Partial<ReceiptWithExpenses> & { id: string; expenses: Expense[] }): ReceiptWithExpenses {
  return {
    date: over.date ?? '2026-01-01',
    description: over.description ?? 'receipt',
    kind: over.kind ?? 'advance',
    paid_by_member_id: over.paid_by_member_id ?? 'm1',
    created_at: over.created_at ?? '2026-01-01T00:00:00Z',
    ...over,
  }
}

describe('filterReceiptsByPayer', () => {
  const advanceM1 = makeReceipt({ id: 'r1', kind: 'advance', paid_by_member_id: 'm1', expenses: [] })
  const advanceM2 = makeReceipt({ id: 'r2', kind: 'advance', paid_by_member_id: 'm2', expenses: [] })
  const card = makeReceipt({ id: 'r3', kind: 'card', paid_by_member_id: null, expenses: [] })
  const receipts = [advanceM1, advanceM2, card]

  it('all は全件通す', () => {
    expect(filterReceiptsByPayer(receipts, { type: 'all' })).toEqual(receipts)
  })

  it('card は kind=card のみ', () => {
    expect(filterReceiptsByPayer(receipts, { type: 'card' })).toEqual([card])
  })

  it('member は当該IDのみ・他メンバー除外', () => {
    expect(filterReceiptsByPayer(receipts, { type: 'member', memberId: 'm1' })).toEqual([advanceM1])
  })

  it('空配列は空配列', () => {
    expect(filterReceiptsByPayer([], { type: 'all' })).toEqual([])
  })
})

describe('collectExpensesByCategory', () => {
  const e1 = makeExpense({ id: 'e1', category_id: 'leafA', receipt_id: 'r1' })
  const e2 = makeExpense({ id: 'e2', category_id: 'leafB', receipt_id: 'r1' })
  const e3 = makeExpense({ id: 'e3', category_id: null, receipt_id: 'r2' })
  const e4 = makeExpense({ id: 'e4', category_id: 'leafA', receipt_id: 'r2' })

  const r1 = makeReceipt({ id: 'r1', date: '2026-01-05', expenses: [e1, e2] })
  const r2 = makeReceipt({ id: 'r2', date: '2026-01-10', expenses: [e3, e4] })
  const receipts = [r1, r2]

  it('特定葉IDに一致する明細のみ集約しレシートを付与', () => {
    const result = collectExpensesByCategory(receipts, 'leafA')
    expect(result.map(x => x.expense.id)).toEqual(['e4', 'e1'])
    expect(result[0].receipt.id).toBe('r2')
    expect(result[1].receipt.id).toBe('r1')
  })

  it('categoryId=null で category_id===null の明細のみ', () => {
    const result = collectExpensesByCategory(receipts, null)
    expect(result.map(x => x.expense.id)).toEqual(['e3'])
  })

  it('一致0件で空', () => {
    expect(collectExpensesByCategory(receipts, 'nope')).toEqual([])
  })

  it('日付降順→同日はレシート内の元順で安定ソート', () => {
    const sameDayR1 = makeReceipt({ id: 'r1', date: '2026-01-05', expenses: [e1, e2] })
    const eX = makeExpense({ id: 'eX', category_id: 'leafA', receipt_id: 'r3' })
    const eY = makeExpense({ id: 'eY', category_id: 'leafA', receipt_id: 'r3' })
    const sameDayR3 = makeReceipt({ id: 'r3', date: '2026-01-05', expenses: [eX, eY] })
    const result = collectExpensesByCategory([sameDayR1, sameDayR3], 'leafA')
    expect(result.map(x => x.expense.id)).toEqual(['e1', 'eX', 'eY'])
  })
})
