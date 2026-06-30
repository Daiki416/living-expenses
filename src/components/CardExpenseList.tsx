import { useState } from 'react'
import type { CardExpense, Category } from '../lib/supabase'
import { formatDate, resolveCategoryLabel } from '../lib/format'

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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const topLevel = cardExpenses.filter(e => e.parent_id === null)
  const childrenByParentId = new Map<string, CardExpense[]>()
  for (const e of cardExpenses) {
    if (e.parent_id !== null) {
      const list = childrenByParentId.get(e.parent_id) ?? []
      list.push(e)
      childrenByParentId.set(e.parent_id, list)
    }
  }

  if (topLevel.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8 text-sm">
        この月のクレカ明細はありません
      </div>
    )
  }

  const categoryName = (id: string | null) => resolveCategoryLabel(id, categories) || null

  const sorted = [...topLevel].sort((a, b) =>
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
          {sorted.map((exp) => {
            const catName = categoryName(exp.category_id)
            const children = childrenByParentId.get(exp.id) ?? []
            const hasChildren = children.length > 0
            const isExpanded = expandedIds.has(exp.id)

            return (
              <>
                <tr
                  key={exp.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => onEdit(exp)}
                >
                  <td className="py-3 pr-3 text-gray-500 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      {hasChildren && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleExpand(exp.id) }}
                          className="text-gray-400 hover:text-indigo-500 transition text-xs leading-none"
                          title={isExpanded ? '閉じる' : '展開'}
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      )}
                      {formatDate(exp.date)}
                    </span>
                  </td>
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
                {isExpanded && children.map((child) => (
                  <tr key={child.id} className="bg-gray-50 text-sm">
                    <td className="py-2 pr-3 text-gray-400 whitespace-nowrap pl-5">
                      {formatDate(child.date)}
                    </td>
                    <td className="py-2 pr-3 w-full text-gray-500 pl-2">
                      {child.description}
                    </td>
                    <td className="py-2 pr-3 text-right text-gray-600 whitespace-nowrap">
                      ¥{child.amount.toLocaleString()}
                    </td>
                    <td className="py-2"></td>
                  </tr>
                ))}
              </>
            )
          })}
        </tbody>
      </table>
      </div>
      {deleteError && <p className="text-red-500 text-sm mt-2">{deleteError}</p>}
    </div>
  )
}
