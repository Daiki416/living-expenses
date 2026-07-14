import type { ReceiptWithExpenses, Expense } from './supabase'
import { EXPENSE_KIND } from '../config/classifications'

export type PayerFilter =
  | { type: 'all' }
  | { type: 'card' }
  | { type: 'member'; memberId: string }

export function filterReceiptsByPayer(
  receipts: ReceiptWithExpenses[],
  payer: PayerFilter,
): ReceiptWithExpenses[] {
  switch (payer.type) {
    case 'all':
      return receipts
    case 'card':
      return receipts.filter(r => r.kind === EXPENSE_KIND.CARD)
    case 'member':
      return receipts.filter(r => r.paid_by_member_id === payer.memberId)
  }
}

export type ExpenseWithReceipt = { expense: Expense; receipt: ReceiptWithExpenses }

// 指定 category_id（null=未分類）に完全一致する明細を、所属レシート付きで集める。
// 日付降順→同日はレシート内の元順で安定ソート。
export function collectExpensesByCategory(
  receipts: ReceiptWithExpenses[],
  categoryId: string | null,
): ExpenseWithReceipt[] {
  const sortedReceipts = [...receipts].sort((a, b) => b.date.localeCompare(a.date))
  const result: ExpenseWithReceipt[] = []
  for (const receipt of sortedReceipts) {
    for (const expense of receipt.expenses) {
      if (expense.category_id === categoryId) {
        result.push({ expense, receipt })
      }
    }
  }
  return result
}
