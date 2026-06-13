import type { Expense } from '../lib/supabase'

type Props = {
  expenses: Expense[]
  members: string[]
}

export function ExpenseSummary({ expenses, members }: Props) {
  const totals: Record<string, number> = Object.fromEntries(members.map(m => [m, 0]))
  expenses.forEach(e => { if (e.paid_by in totals) totals[e.paid_by] += e.amount })

  return (
    <div className="grid grid-cols-2 gap-4 mt-6">
      {members.map((m) => (
        <div key={m} className="bg-indigo-50 rounded-xl p-4 text-center">
          <div className="text-sm text-indigo-500 font-medium mb-1">{m}</div>
          <div className="text-2xl font-semibold text-indigo-700">
            ¥{totals[m].toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  )
}
