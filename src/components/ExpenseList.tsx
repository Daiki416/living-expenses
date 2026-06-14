import { useState } from 'react'
import type { Expense, Category } from '../lib/supabase'
import { formatDate } from '../lib/format'

type Props = {
  expenses: Expense[]
  categories: Category[]
  onEdit: (expense: Expense) => void
  onDelete: (id: string) => Promise<void>
}

function resolveCategoryLabel(categoryId: string | null, categories: Category[]): string {
  if (!categoryId) return ''
  const cat = categories.find(c => c.id === categoryId)
  if (!cat) return ''
  if (cat.parent_id) {
    const parent = categories.find(c => c.id === cat.parent_id)
    return parent ? `${parent.name} > ${cat.name}` : cat.name
  }
  return cat.name
}

export function ExpenseList({ expenses, categories, onEdit, onDelete }: Props) {
  const categoryName = (id: string | null) => resolveCategoryLabel(id, categories) || null
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(false)

  if (expenses.length === 0) {
    return (
      <div className="text-center text-gray-400 py-12 text-sm">
        この月の立て替えはありません
      </div>
    )
  }

  const sorted = [...expenses].sort((a, b) =>
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
                  <div className="flex justify-between items-center text-xs text-gray-400 mt-0.5">
                    <span>{exp.paid_by}</span>
                    {catName && <span>{catName}</span>}
                  </div>
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
