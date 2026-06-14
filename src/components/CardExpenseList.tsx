import { useState } from 'react'
import type { CardExpense, Category } from '../lib/supabase'
import { formatDate } from '../lib/format'

type Props = {
  cardExpenses: CardExpense[]
  categories: Category[]
  onEdit: (cardExpense: CardExpense) => void
  onDelete: (id: string) => Promise<void>
}

export function CardExpenseList({ cardExpenses, categories, onEdit, onDelete }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(false)

  if (cardExpenses.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8 text-sm">
        この月のクレカ明細はありません
      </div>
    )
  }

  const categoryName = (id: string | null) =>
    id ? (categories.find(c => c.id === id)?.name ?? null) : null

  const sorted = [...cardExpenses].sort((a, b) =>
    sortAsc ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500 text-left">
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
          {sorted.map((exp) => {
            const catName = categoryName(exp.category_id)
            return (
              <tr
                key={exp.id}
                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                onClick={() => onEdit(exp)}
              >
                <td className="py-3 pr-3 text-gray-500 whitespace-nowrap">{formatDate(exp.date)}</td>
                <td className="py-3 pr-3 w-full">
                  <div className="text-gray-700 text-sm">{exp.description}</div>
                  {catName && (
                    <div className="text-xs text-gray-400 mt-0.5 text-right">{catName}</div>
                  )}
                </td>
                <td className="py-3 pr-3 text-right font-medium text-gray-800 whitespace-nowrap">
                  ¥{exp.amount.toLocaleString()}
                </td>
                <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={async () => {
                      setDeleteError(null)
                      setDeletingId(exp.id)
                      try {
                        await onDelete(exp.id)
                      } catch (err) {
                        setDeleteError((err as Error).message)
                      } finally {
                        setDeletingId(null)
                      }
                    }}
                    disabled={deletingId === exp.id}
                    className="text-gray-300 hover:text-red-400 disabled:opacity-40 transition text-base leading-none"
                    title="削除"
                  >
                    ×
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {deleteError && <p className="text-red-500 text-sm mt-2">{deleteError}</p>}
    </div>
  )
}
