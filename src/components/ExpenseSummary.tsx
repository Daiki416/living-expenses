import type { Expense } from '../lib/supabase'

type Props = {
  expenses: Expense[]
  members: [string, string]
}

export function ExpenseSummary({ expenses, members }: Props) {
  const totals = members.map((m) =>
    expenses.filter((e) => e.paid_by === m).reduce((sum, e) => sum + e.amount, 0)
  )

  return (
    <div className="grid grid-cols-2 gap-4 mt-6">
      {members.map((m, i) => (
        <div key={m} className="bg-indigo-50 rounded-xl p-4 text-center">
          <div className="text-sm text-indigo-500 font-medium mb-1">{m}</div>
          <div className="text-2xl font-semibold text-indigo-700">
            ¥{totals[i].toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  )
}
