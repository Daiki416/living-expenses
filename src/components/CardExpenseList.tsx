import { useState } from 'react'
import type { CardExpense, Category, CardExpenseReceiptWithCardExpenses } from '../lib/supabase'
import { formatDate, resolveCategoryLabel } from '../lib/format'

type Props = {
  receipts: CardExpenseReceiptWithCardExpenses[]
  categories: Category[]
  onEdit: (cardExpense: CardExpense) => void
  onDeleteReceipt: (receiptId: string) => Promise<void>
  onUpdateDescription: (receiptId: string, description: string) => Promise<void>
}

export function CardExpenseList({ receipts, categories, onEdit, onDeleteReceipt, onUpdateDescription }: Props) {
  const categoryName = (id: string | null) => resolveCategoryLabel(id, categories) || null
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [savingReceiptId, setSavingReceiptId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  if (receipts.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8 text-sm">
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

  async function save(id: string) {
    if (editingValue.trim() === '') {
      setEditingReceiptId(null)
      return
    }
    setSavingReceiptId(id)
    try {
      await onUpdateDescription(id, editingValue.trim())
      setEditingReceiptId(null)
    } catch (err) {
      setSaveError((err as Error).message)
    } finally {
      setSavingReceiptId(null)
    }
  }

  return (
    <div className="overflow-x-auto">
      <div className="max-h-96 overflow-y-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="sticky top-0 bg-white z-10 border-b border-gray-200 text-gray-500 text-left">
            <th className="pb-2 pr-3 font-medium whitespace-nowrap">
              <button
                onClick={() => setSortAsc(v => !v)}
                className="hover:text-indigo-500 transition"
              >
                日付 {sortAsc ? '↑' : '↓'}
              </button>
            </th>
            <th className="pb-2 pr-3 font-medium w-full">内容</th>
            <th className="pb-2 pr-3 font-medium text-right whitespace-nowrap">金額</th>
            <th className="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((receipt) => {
            const total = receipt.card_expenses.reduce((s, e) => s + e.amount, 0)
            const isExpanded = expandedIds.has(receipt.id)

            return (
              <>
                <tr
                  key={receipt.id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-3 pr-3 text-gray-500 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleExpand(receipt.id)}
                        className="text-gray-400 hover:text-indigo-500 transition text-xs leading-none"
                        title={isExpanded ? '閉じる' : '展開'}
                      >
                        {isExpanded ? '▼' : '▶'}
                      </button>
                      {formatDate(receipt.date)}
                    </span>
                  </td>
                  <td className="py-3 pr-3 w-full">
                    {editingReceiptId === receipt.id ? (
                      <input
                        autoFocus
                        value={editingValue}
                        onChange={e => setEditingValue(e.target.value)}
                        onBlur={() => save(receipt.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); save(receipt.id) }
                          if (e.key === 'Escape') { e.preventDefault(); setEditingReceiptId(null) }
                        }}
                        disabled={savingReceiptId === receipt.id}
                        className="w-full text-gray-700 text-sm bg-transparent outline-none border-b border-indigo-400 px-0 py-0 disabled:opacity-50"
                      />
                    ) : (
                      <div
                        className="text-gray-700 text-sm cursor-pointer"
                        onClick={() => { setEditingReceiptId(receipt.id); setEditingValue(receipt.description) }}
                      >
                        {receipt.description}
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-right font-medium text-gray-800 whitespace-nowrap">
                    ¥{total.toLocaleString()}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={async () => {
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
                      className="text-gray-300 hover:text-red-400 disabled:opacity-40 transition text-base leading-none"
                      title="削除"
                    >
                      ×
                    </button>
                  </td>
                </tr>
                {isExpanded && receipt.card_expenses.map((expense) => {
                  const catName = categoryName(expense.category_id)
                  return (
                    <tr
                      key={expense.id}
                      className="bg-gray-50 text-sm cursor-pointer"
                      onClick={() => onEdit(expense)}
                    >
                      <td className="py-2 pr-3 text-gray-400 whitespace-nowrap pl-5"></td>
                      <td className="py-2 pr-3 w-full text-gray-500 pl-2">
                        <div>{expense.description}</div>
                        {catName && <div className="text-xs text-gray-400">{catName}</div>}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-600 whitespace-nowrap">
                        ¥{expense.amount.toLocaleString()}
                      </td>
                      <td className="py-2"></td>
                    </tr>
                  )
                })}
              </>
            )
          })}
        </tbody>
      </table>
      </div>
      {deleteError && <p className="text-red-500 text-sm mt-2">{deleteError}</p>}
      {saveError && <p className="text-red-500 text-sm mt-2">{saveError}</p>}
    </div>
  )
}
