import type { Expense, CardExpense, Category } from '../lib/supabase'

type Props = {
  expenses: Expense[]
  cardExpenses: CardExpense[]
  categories: Category[]
  loading?: boolean
}

export function CategorySummary({ expenses, cardExpenses, categories, loading }: Props) {
  const totals: Record<string, number> = {}

  for (const e of [...expenses, ...cardExpenses]) {
    const key = e.category_id ?? '__uncategorized__'
    totals[key] = (totals[key] ?? 0) + e.amount
  }

  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0)
  const cardTotal = cardExpenses.reduce((s, e) => s + e.amount, 0)
  const grandTotal = expenseTotal + cardTotal

  if (loading) return null
  if (grandTotal === 0) return null

  const categoryName = (id: string) =>
    id === '__uncategorized__' ? '未分類' : (categories.find(c => c.id === id)?.name ?? '未分類')

  const sortedKeys = Object.keys(totals).sort((a, b) => {
    if (a === '__uncategorized__') return 1
    if (b === '__uncategorized__') return -1
    return totals[b] - totals[a]
  })

  return (
    <div className="bg-white rounded-xl shadow-sm px-5 py-4 mt-4">
      <h2 className="text-sm font-medium text-gray-500 mb-3">カテゴリー別合計</h2>
      <div className="space-y-2">
        {sortedKeys.map(key => (
          <div key={key} className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{categoryName(key)}</span>
            <span className="font-medium text-gray-800">¥{totals[key].toLocaleString()}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-100 mt-3 pt-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">合計</span>
        <div className="text-right">
          <div className="font-bold text-gray-900">¥{grandTotal.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            立替 ¥{expenseTotal.toLocaleString()} / クレカ ¥{cardTotal.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  )
}
