import { useState } from 'react'
import type { CardExpense, Category, CardExpenseReceiptWithCardExpenses } from '../lib/supabase'
import { resolveCategoryLabel, splitDateChip } from '../lib/format'
import { resolveCategoryColor } from '../lib/categoryColors'

type Props = {
  receipts: CardExpenseReceiptWithCardExpenses[]
  categories: Category[]
  onEdit: (cardExpense: CardExpense) => void
  onDeleteReceipt: (receiptId: string) => Promise<void>
  onEditReceipt: (receiptId: string) => void
}

export function CardExpenseList({ receipts, categories, onEdit, onDeleteReceipt, onEditReceipt }: Props) {
  const categoryName = (id: string | null) => {
    const label = resolveCategoryLabel(id, categories)
    return label ? label.replace(' > ', ' › ') : null
  }
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  if (receipts.length === 0) {
    return (
      <div className="text-center text-ink-4 py-8 text-sm">
        この月のクレカ明細はありません
      </div>
    )
  }

  const sorted = [...receipts].sort((a, b) =>
    sortAsc ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
  )

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div>
      <div className="max-h-96 overflow-y-auto">
        <div className="flex items-center justify-end px-1 pb-2 sticky top-0 bg-surface z-10">
          <button
            onClick={() => setSortAsc(v => !v)}
            className="text-xs text-ink-3 hover:text-indigo-500 transition-colors"
          >
            日付 {sortAsc ? '↑' : '↓'}
          </button>
        </div>
        <div>
          {sorted.map((receipt) => {
            const total = receipt.card_expenses.reduce((s, e) => s + e.amount, 0)
            const isExpanded = expandedIds.has(receipt.id)
            const { month, day } = splitDateChip(receipt.date)
            const count = receipt.card_expenses.length
            const metaLabel = `${count}件`

            return (
              <div key={receipt.id} className="border-b border-line">
                <div className="flex items-center gap-3 py-3">
                  <button
                    type="button"
                    onClick={() => toggleExpand(receipt.id)}
                    title={isExpanded ? '閉じる' : '展開'}
                    className="flex flex-col items-center justify-center shrink-0 w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/25 transition-colors leading-none"
                  >
                    <span className="text-[10px] tabular-nums">{month}</span>
                    <span className="text-base font-semibold tabular-nums">{day}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditReceipt(receipt.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="font-semibold text-ink text-sm truncate">{receipt.description}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-4">
                      {metaLabel && <span>{metaLabel}</span>}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleExpand(receipt.id)}
                    className="flex items-center gap-1.5 shrink-0"
                  >
                    <span className="text-base font-semibold text-ink tabular-nums">¥{total.toLocaleString()}</span>
                    <svg
                      className={`w-4 h-4 text-ink-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path fillRule="evenodd" d="M5.2 7.5 10 12.3l4.8-4.8 1.2 1.2L10 14.7 4 8.7z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation()
                      setDeleteError(null)
                      setDeletingId(receipt.id)
                      try {
                        await onDeleteReceipt(receipt.id)
                      } catch (err) {
                        setDeleteError((err as Error).message)
                      } finally {
                        setDeletingId(null)
                      }
                    }}
                    disabled={deletingId === receipt.id}
                    className="shrink-0 text-ink-4 hover:text-red-400 disabled:opacity-40 transition-colors text-base leading-none"
                    title="削除"
                  >
                    ×
                  </button>
                </div>
                {isExpanded && (
                  <div className="pb-2 pl-14 pr-1 space-y-1">
                    {receipt.card_expenses.map((expense) => {
                      const catName = categoryName(expense.category_id)
                      return (
                        <button
                          type="button"
                          key={expense.id}
                          onClick={() => onEdit(expense)}
                          className="w-full flex items-center gap-2.5 py-1.5 text-left rounded-lg hover:bg-inset transition-colors"
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0 self-start mt-1.5"
                            style={{ backgroundColor: resolveCategoryColor(expense.category_id, categories) ?? '#d1d5db' }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-ink-2 truncate">{expense.description}</div>
                            {catName && <div className="text-xs text-ink-4 truncate">{catName}</div>}
                          </div>
                          <span className="shrink-0 text-sm text-ink-2 tabular-nums">¥{expense.amount.toLocaleString()}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      {deleteError && <p className="text-red-500 text-sm mt-2">{deleteError}</p>}
    </div>
  )
}
