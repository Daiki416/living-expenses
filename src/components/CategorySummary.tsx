import { useState } from 'react'
import type { Expense, CardExpense, Category } from '../lib/supabase'
import { CHART_COLORS } from '../lib/chartColors'

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
  const [view, setView] = useState<'table' | 'chart'>('table')
  const [chartMode, setChartMode] = useState<'parent' | 'child'>('parent')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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

  const cx = 100
  const cy = 100
  const r = 80

  const count = expenses.length + cardExpenses.length
  const maxParentAmount = Math.max(...Object.values(parentTotals))

  return (
    <div className="card px-5 py-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-600">カテゴリー別合計</h2>
        <button
          className="text-xs text-gray-500 border border-gray-200 rounded px-2 py-1"
          onClick={() => setView(v => v === 'table' ? 'chart' : 'table')}
        >
          {view === 'table' ? '円グラフ' : '内訳'}
        </button>
      </div>
      {view === 'table' && (
        <div>
          <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
            <svg viewBox="0 0 200 200" className="w-28 h-28 flex-shrink-0">
              {sortedParentIds.length === 1 ? (
                <circle cx={cx} cy={cy} r={r} fill={CHART_COLORS[0]} />
              ) : (
                (() => {
                  let cumAngle = -Math.PI / 2
                  return sortedParentIds.map((parentId, index) => {
                    const sliceAngle = (parentTotals[parentId] / grandTotal) * 2 * Math.PI
                    const startAngle = cumAngle
                    const endAngle = cumAngle + sliceAngle
                    cumAngle = endAngle

                    const x1 = cx + r * Math.cos(startAngle)
                    const y1 = cy + r * Math.sin(startAngle)
                    const x2 = cx + r * Math.cos(endAngle)
                    const y2 = cy + r * Math.sin(endAngle)
                    const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0
                    const color = CHART_COLORS[index % CHART_COLORS.length]

                    return (
                      <path
                        key={parentId}
                        d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                        fill={color}
                      />
                    )
                  })
                })()
              )}
              <circle cx={100} cy={100} r={52} fill="#fff" />
              <text x={100} y={96} textAnchor="middle" className="fill-gray-800" style={{ fontSize: '26px', fontWeight: 700 }}>{count}</text>
              <text x={100} y={120} textAnchor="middle" className="fill-gray-400" style={{ fontSize: '13px' }}>件</text>
            </svg>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-400">今月合計</div>
              <div className="text-2xl font-bold text-gray-900 tabular-nums">¥{grandTotal.toLocaleString()}</div>
              <div className="mt-2 h-2 rounded-full overflow-hidden flex bg-gray-100">
                <div style={{ width: `${(expenseTotal / grandTotal) * 100}%`, backgroundColor: '#6366f1' }} />
                <div style={{ width: `${(cardTotal / grandTotal) * 100}%`, backgroundColor: '#f59e0b' }} />
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-gray-400 tabular-nums">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#6366f1' }} />
                  立替 ¥{expenseTotal.toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                  クレカ ¥{cardTotal.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-2">
            {sortedParentIds.map((parentId, index) => {
              const parentName = parentId === '__uncategorized__'
                ? '未分類'
                : (parentCategories.find(c => c.id === parentId)?.name ?? '未分類')
              const children = categories.filter(c => c.parent_id === parentId)
              const activeChildren = children.filter(c => childTotals[c.id])
              const directAmount = parentTotals[parentId] - Object.entries(childTotals)
                .filter(([childId]) => categories.find(c => c.id === childId)?.parent_id === parentId)
                .reduce((s, [, v]) => s + v, 0)
              const hasChildren = activeChildren.length > 0
              const isExpanded = expandedIds.has(parentId)
              const color = CHART_COLORS[index % CHART_COLORS.length]
              const barPct = (parentTotals[parentId] / maxParentAmount) * 100
              const sharePct = ((parentTotals[parentId] / grandTotal) * 100).toFixed(1)

              return (
                <div key={parentId} className="border-b border-gray-50 last:border-0">
                  <button
                    type="button"
                    onClick={() => hasChildren && toggleExpand(parentId)}
                    className="w-full flex items-center gap-3 py-2 text-left"
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 truncate">{parentName}</span>
                        <span className="text-sm font-medium text-gray-800 tabular-nums ml-2">¥{parentTotals[parentId].toLocaleString()}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${barPct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 justify-end">
                      <span className="text-xs text-gray-400 tabular-nums w-10 text-right">{sharePct}%</span>
                      {hasChildren ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          className={`w-3 h-3 text-gray-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : <span className="w-3" />}
                    </div>
                  </button>
                  {isExpanded && hasChildren && (
                    <div className="pl-6 pb-1 space-y-0.5">
                      {activeChildren.map(child => (
                        <div key={child.id} className="flex items-center justify-between text-sm py-0.5">
                          <span className="text-gray-500">{child.name}</span>
                          <span className="text-gray-600 tabular-nums">¥{childTotals[child.id].toLocaleString()}</span>
                        </div>
                      ))}
                      {directAmount > 0 && (
                        <div className="flex items-center justify-between text-sm py-0.5">
                          <span className="text-gray-400">{parentName}（全般）</span>
                          <span className="text-gray-500 tabular-nums">¥{directAmount.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {view === 'chart' && (
        <div>
          <div className="flex gap-1 mb-3">
            <button
              className={`text-xs px-3 py-1 rounded border ${chartMode === 'parent' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'text-gray-500 border-gray-200'}`}
              onClick={() => setChartMode('parent')}
            >
              大分類
            </button>
            <button
              className={`text-xs px-3 py-1 rounded border ${chartMode === 'child' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'text-gray-500 border-gray-200'}`}
              onClick={() => setChartMode('child')}
            >
              小分類
            </button>
          </div>
          {(() => {
            const childEntries: { id: string; name: string; amount: number }[] = []
            for (const parentId of sortedParentIds) {
              const parentName = parentId === '__uncategorized__'
                ? '未分類'
                : (parentCategories.find(c => c.id === parentId)?.name ?? '未分類')
              const children = categories.filter(c => c.parent_id === parentId)
              const activeChildren = children.filter(c => childTotals[c.id])
              if (activeChildren.length > 0) {
                for (const child of activeChildren) {
                  childEntries.push({ id: child.id, name: child.name, amount: childTotals[child.id] })
                }
                const childSum = activeChildren.reduce((s, c) => s + childTotals[c.id], 0)
                const direct = parentTotals[parentId] - childSum
                if (direct > 0) {
                  childEntries.push({ id: `${parentId}__direct`, name: `${parentName}（全般）`, amount: direct })
                }
              } else {
                childEntries.push({ id: parentId, name: parentName, amount: parentTotals[parentId] })
              }
            }
            childEntries.sort((a, b) => b.amount - a.amount)

            const entries = chartMode === 'parent'
              ? sortedParentIds.map(parentId => ({
                  id: parentId,
                  name: parentId === '__uncategorized__'
                    ? '未分類'
                    : (parentCategories.find(c => c.id === parentId)?.name ?? '未分類'),
                  amount: parentTotals[parentId],
                }))
              : childEntries

            return (
              <>
                {entries.length === 1 ? (
                  <svg viewBox="0 0 200 200" width="100%" height="auto">
                    <circle cx={cx} cy={cy} r={r} fill={CHART_COLORS[0]} />
                  </svg>
                ) : (
                  <svg viewBox="0 0 200 200" width="100%" height="auto">
                    {(() => {
                      let cumAngle = -Math.PI / 2
                      return entries.map((entry, index) => {
                        const sliceAngle = (entry.amount / grandTotal) * 2 * Math.PI
                        const startAngle = cumAngle
                        const endAngle = cumAngle + sliceAngle
                        cumAngle = endAngle

                        const x1 = cx + r * Math.cos(startAngle)
                        const y1 = cy + r * Math.sin(startAngle)
                        const x2 = cx + r * Math.cos(endAngle)
                        const y2 = cy + r * Math.sin(endAngle)
                        const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0
                        const color = CHART_COLORS[index % CHART_COLORS.length]

                        return (
                          <path
                            key={entry.id}
                            d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                            fill={color}
                          />
                        )
                      })
                    })()}
                  </svg>
                )}
                <div className="mt-3 space-y-1">
                  {entries.map((entry, index) => {
                    const color = CHART_COLORS[index % CHART_COLORS.length]
                    const pct = ((entry.amount / grandTotal) * 100).toFixed(1)
                    return (
                      <div key={entry.id} className="flex items-center gap-2 text-sm">
                        <span className="inline-block rounded-sm flex-shrink-0" style={{ width: 12, height: 12, backgroundColor: color }} />
                        <span className="text-gray-700">{entry.name}</span>
                        <span className="text-gray-400 ml-auto tabular-nums">¥{entry.amount.toLocaleString()} ({pct}%)</span>
                      </div>
                    )
                  })}
                </div>
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}
