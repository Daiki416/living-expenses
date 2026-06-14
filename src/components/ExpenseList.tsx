import { useState } from 'react'
import type { Expense } from '../lib/supabase'

type Props = {
  expenses: Expense[]
  onDelete: (id: string) => Promise<void>
}

function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`
}

export function ExpenseList({ expenses, onDelete }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  if (expenses.length === 0) {
    return (
      <div className="text-center text-gray-400 py-12 text-sm">
        この月の立て替えはありません
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500 text-left">
            <th className="pb-2 pr-3 font-medium whitespace-nowrap">日付</th>
            <th className="pb-2 pr-3 font-medium w-full">内容</th>
            <th className="pb-2 pr-3 font-medium text-right whitespace-nowrap">金額</th>
            <th className="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((exp) => (
            <tr key={exp.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-3 pr-3 text-gray-500 whitespace-nowrap">{formatDate(exp.date)}</td>
              <td className="py-3 pr-3 w-full">
                <div className="text-gray-700 text-sm">{exp.description}</div>
                <div className="text-xs text-gray-400 mt-0.5">{exp.paid_by}</div>
              </td>
              <td className="py-3 pr-3 text-right font-medium text-gray-800 whitespace-nowrap">
                ¥{exp.amount.toLocaleString()}
              </td>
              <td className="py-3 text-right">
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
          ))}
        </tbody>
      </table>
      {deleteError && <p className="text-red-500 text-sm mt-2">{deleteError}</p>}
    </div>
  )
}
