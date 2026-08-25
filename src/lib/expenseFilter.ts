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

// 表示中の月に読み込み済みの receipts を、レシート名または明細名の部分一致で絞る。
// クエリは trim + 小文字化して比較。空クエリは全件そのまま返す。レシート単位で残す/落とす。
export function filterReceiptsByQuery(
  receipts: ReceiptWithExpenses[],
  query: string,
): ReceiptWithExpenses[] {
  const q = query.trim().toLowerCase()
  if (q === '') return receipts
  return receipts.filter(r =>
    r.description.toLowerCase().includes(q) ||
    r.expenses.some(e => e.description.toLowerCase().includes(q))
  )
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
