import type { Expense } from '../lib/supabase'

type Props = {
  expenses: Expense[]
  onDelete: (id: string) => Promise<void>
}

function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}月${parseInt(d)}日`
}

export function ExpenseList({ expenses, onDelete }: Props) {
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
            <th className="pb-2 pr-4 font-medium w-24">日付</th>
            <th className="pb-2 pr-4 font-medium w-24">支払者</th>
            <th className="pb-2 pr-4 font-medium">内容</th>
            <th className="pb-2 pr-4 font-medium text-right w-28">金額</th>
            <th className="pb-2 w-12"></th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((exp) => (
            <tr key={exp.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-3 pr-4 text-gray-500">{formatDate(exp.date)}</td>
              <td className="py-3 pr-4 font-medium text-gray-700">{exp.paid_by}</td>
              <td className="py-3 pr-4 text-gray-700">{exp.description}</td>
              <td className="py-3 pr-4 text-right font-medium text-gray-800">
                ¥{exp.amount.toLocaleString()}
              </td>
              <td className="py-3 text-right">
                <button
                  onClick={async () => {
                    try {
                      await onDelete(exp.id)
                    } catch (err) {
                      window.alert(`削除に失敗しました: ${(err as Error).message}`)
                    }
                  }}
                  className="text-gray-300 hover:text-red-400 transition text-base leading-none"
                  title="削除"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
