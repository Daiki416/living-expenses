import type { Expense } from '../lib/supabase'
import type { ExpenseWithReceipt } from '../lib/expenseFilter'
import { ModalShell } from './ModalShell'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { splitDateChip } from '../lib/format'
import { EXPENSE_KIND, EXPENSE_KIND_LABEL } from '../config/classifications'

type Props = {
  title: string
  items: ExpenseWithReceipt[]
  memberNameById: ReadonlyMap<string, string>
  onSelectExpense: (expense: Expense) => void
  onClose: () => void
}

export function CategoryDrilldownModal({ title, items, memberNameById, onSelectExpense, onClose }: Props) {
  useEscapeKey(onClose)

  const total = items.reduce((s, { expense }) => s + expense.amount, 0)

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink truncate">{title}</h2>
          <div className="text-lg font-bold text-ink tabular-nums">¥{total.toLocaleString()}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-ink-4 hover:text-ink-2 transition-colors text-base leading-none"
          title="閉じる"
        >
          ×
        </button>
      </div>
      <div className="max-h-96 overflow-y-auto -mx-1">
        {items.map(({ expense, receipt }) => {
          const { month, day } = splitDateChip(receipt.date)
          const payerLabel = receipt.kind === EXPENSE_KIND.CARD
            ? EXPENSE_KIND_LABEL.card
            : (receipt.paid_by_member_id ? memberNameById.get(receipt.paid_by_member_id) ?? '' : '')
          return (
            <button
              type="button"
              key={expense.id}
              onClick={() => onSelectExpense(expense)}
              className="w-full flex items-center gap-3 py-2 px-1 text-left rounded-lg hover:bg-inset transition-colors border-b border-line last:border-0"
            >
              <div className="flex flex-col items-center justify-center shrink-0 w-10 leading-none text-ink-4">
                <span className="text-[10px] tabular-nums">{month}</span>
                <span className="text-sm font-semibold text-ink-2 tabular-nums">{day}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-ink-2 truncate">{expense.description}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-4">
                  <span className="truncate">{receipt.description}</span>
                  {payerLabel && <span className="chip px-1.5 py-0.5 text-[11px] bg-inset shrink-0">{payerLabel}</span>}
                </div>
              </div>
              <span className="shrink-0 text-sm font-medium text-ink tabular-nums">¥{expense.amount.toLocaleString()}</span>
            </button>
          )
        })}
      </div>
    </ModalShell>
  )
}
