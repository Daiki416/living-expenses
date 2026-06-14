import type { Expense, CardExpense, Category } from '../lib/supabase'

type Props = {
  expenses: Expense[]
  cardExpenses: CardExpense[]
  categories: Category[]
  loading?: boolean
}

function getEffectiveParentId(categoryId: string | null, categories: Category[]): string | null {
  if (!categoryId) return null
  const cat = categories.find(c => c.id === categoryId)
  if (!cat) return null
  return cat.parent_id ?? cat.id
}

export function CategorySummary({ expenses, cardExpenses, categories, loading }: Props) {
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0)
  const cardTotal = cardExpenses.reduce((s, e) => s + e.amount, 0)
  const grandTotal = expenseTotal + cardTotal

  if (loading) return null
  if (grandTotal === 0) return null

  const parentTotals: Record<string, number> = {}
  const childTotals: Record<string, number> = {}

  for (const e of [...expenses, ...cardExpenses]) {
    const parentId = getEffectiveParentId(e.category_id, categories) ?? '__uncategorized__'
    parentTotals[parentId] = (parentTotals[parentId] ?? 0) + e.amount

    const cat = e.category_id ? categories.find(c => c.id === e.category_id) : null
    if (cat?.parent_id) {
      childTotals[cat.id] = (childTotals[cat.id] ?? 0) + e.amount
    }
  }

  const parentCategories = categories.filter(c => c.parent_id === null)

  const sortedParentIds = Object.keys(parentTotals).sort((a, b) => {
    if (a === '__uncategorized__') return 1
    if (b === '__uncategorized__') return -1
    return parentTotals[b] - parentTotals[a]
  })

  return (
    <div className="bg-white rounded-xl shadow-sm px-5 py-4 mt-4">
      <h2 className="text-sm font-medium text-gray-500 mb-3">カテゴリー別合計</h2>
      <div className="space-y-1">
        {sortedParentIds.map(parentId => {
          const parentName = parentId === '__uncategorized__'
            ? '未分類'
            : (parentCategories.find(c => c.id === parentId)?.name ?? '未分類')
          const children = categories.filter(c => c.parent_id === parentId)
          const directAmount = parentTotals[parentId] - Object.entries(childTotals)
            .filter(([childId]) => categories.find(c => c.id === childId)?.parent_id === parentId)
            .reduce((s, [, v]) => s + v, 0)

          return (
            <div key={parentId}>
              <div className="flex items-center justify-between text-sm py-1">
                <span className="font-medium text-gray-700">{parentName}</span>
                <span className="font-medium text-gray-800">¥{parentTotals[parentId].toLocaleString()}</span>
              </div>
              {children.filter(c => childTotals[c.id]).map(child => (
                <div key={child.id} className="flex items-center justify-between text-sm pl-4 py-0.5">
                  <span className="text-gray-500">{child.name}</span>
                  <span className="text-gray-600">¥{childTotals[child.id].toLocaleString()}</span>
                </div>
              ))}
              {directAmount > 0 && children.some(c => childTotals[c.id]) && (
                <div className="flex items-center justify-between text-sm pl-4 py-0.5">
                  <span className="text-gray-500">{parentName}（全般）</span>
                  <span className="text-gray-600">¥{directAmount.toLocaleString()}</span>
                </div>
              )}
            </div>
          )
        })}
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
