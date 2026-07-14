import { useState } from 'react'
import type { Expense, Category, ReceiptWithExpenses } from '../lib/supabase'
import { parentCategoryColor, childCategoryColor, generalCategoryColor } from '../lib/categoryColors'
import { EXPENSE_KIND_LABEL } from '../config/classifications'
import { collectExpensesByCategory } from '../lib/expenseFilter'
import { CategoryDrilldownModal } from './CategoryDrilldownModal'

type Props = {
  expenses: Expense[]
  cardExpenses: Expense[]
  memberTotals: Record<string, number>
  categories: Category[]
  receipts: ReceiptWithExpenses[]
  memberNameById: ReadonlyMap<string, string>
  onEditExpense: (expense: Expense) => void
  loading?: boolean
}

type DrillTarget = { categoryId: string | null; title: string }

const EXPENSE_BAR_COLOR = '#6366f1' // 立替（インディゴ）
const CARD_BAR_COLOR = '#a78bfa'    // クレカ（バイオレット・同系色）

function getEffectiveParentId(categoryId: string | null, categories: Category[]): string | null {
  if (!categoryId) return null
  const cat = categories.find(c => c.id === categoryId)
  if (!cat) return null
  return cat.parent_id ?? cat.id
}

export function CategorySummary({ expenses, cardExpenses, memberTotals, categories, receipts, memberNameById, onEditExpense, loading }: Props) {
  const [view, setView] = useState<'table' | 'chart'>('table')
  const [chartMode, setChartMode] = useState<'parent' | 'child'>('parent')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [drill, setDrill] = useState<DrillTarget | null>(null)

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
        <h2 className="text-sm font-semibold text-ink-2">カテゴリー別合計</h2>
        <button
          className="text-xs text-ink-3 border border-line rounded px-2 py-1"
          onClick={() => setView(v => v === 'table' ? 'chart' : 'table')}
        >
          {view === 'table' ? '円グラフ' : '内訳'}
        </button>
      </div>
      {view === 'table' && (
        <div>
          <div className="flex items-center gap-4 pb-4 border-b border-line">
            <svg viewBox="0 0 200 200" className="w-28 h-28 flex-shrink-0">
              {sortedParentIds.length === 1 ? (
                <circle cx={cx} cy={cy} r={r} fill={parentCategoryColor(sortedParentIds[0], categories)} />
              ) : (
                (() => {
                  let cumAngle = -Math.PI / 2
                  return sortedParentIds.map((parentId) => {
                    const sliceAngle = (parentTotals[parentId] / grandTotal) * 2 * Math.PI
                    const startAngle = cumAngle
                    const endAngle = cumAngle + sliceAngle
                    cumAngle = endAngle

                    const x1 = cx + r * Math.cos(startAngle)
                    const y1 = cy + r * Math.sin(startAngle)
                    const x2 = cx + r * Math.cos(endAngle)
                    const y2 = cy + r * Math.sin(endAngle)
                    const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0
                    const color = parentCategoryColor(parentId, categories)

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
              <circle cx={100} cy={100} r={52} className="fill-surface" />
              <text x={100} y={96} textAnchor="middle" className="fill-ink" style={{ fontSize: '26px', fontWeight: 700 }}>{count}</text>
              <text x={100} y={120} textAnchor="middle" className="fill-ink-4" style={{ fontSize: '13px' }}>件</text>
            </svg>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-ink-4">今月合計</div>
              <div className="text-2xl font-bold text-ink tabular-nums">¥{grandTotal.toLocaleString()}</div>
              <div className="mt-2 h-2 rounded-full overflow-hidden flex bg-inset">
                <div style={{ width: `${(expenseTotal / grandTotal) * 100}%`, backgroundColor: EXPENSE_BAR_COLOR }} />
                <div style={{ width: `${(cardTotal / grandTotal) * 100}%`, backgroundColor: CARD_BAR_COLOR }} />
              </div>
              <div className="mt-2 space-y-1 text-sm text-ink-2 tabular-nums">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <span className="cat-dot w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: EXPENSE_BAR_COLOR }} />
                    立替
                  </span>
                  <span className="font-medium">¥{expenseTotal.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <span className="cat-dot w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CARD_BAR_COLOR }} />
                    {EXPENSE_KIND_LABEL.card}
                  </span>
                  <span className="font-medium">¥{cardTotal.toLocaleString()}</span>
                </div>
              </div>
              {Object.entries(memberTotals).some(([, v]) => v > 0) && (
                <div className="mt-2 pt-2 border-t border-line space-y-1 text-sm text-ink-3 tabular-nums">
                  {Object.entries(memberTotals)
                    .filter(([, v]) => v > 0)
                    .map(([name, v]) => (
                      <div key={name} className="flex items-center justify-between gap-2">
                        <span>{name} {EXPENSE_KIND_LABEL.advance}</span>
                        <span className="font-medium text-ink-2">¥{v.toLocaleString()}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
          <div className="mt-2">
            {sortedParentIds.map((parentId) => {
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
              const color = parentCategoryColor(parentId, categories)
              const barPct = (parentTotals[parentId] / maxParentAmount) * 100
              const sharePct = ((parentTotals[parentId] / grandTotal) * 100).toFixed(1)

              return (
                <div key={parentId} className="border-b border-gray-50 dark:border-white/5 last:border-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (hasChildren) {
                        toggleExpand(parentId)
                      } else {
                        setDrill({
                          categoryId: parentId === '__uncategorized__' ? null : parentId,
                          title: parentName,
                        })
                      }
                    }}
                    className={`w-full flex items-center gap-3 py-2 px-1 -mx-1 rounded-lg text-left transition-colors ${hasChildren ? '' : 'hover:bg-inset'}`}
                  >
                    <span className="cat-dot w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-ink-2 truncate">{parentName}</span>
                        <span className="text-sm font-medium text-ink tabular-nums ml-2">¥{parentTotals[parentId].toLocaleString()}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-inset overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${barPct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 justify-end">
                      <span className="text-xs text-ink-4 tabular-nums w-10 text-right">{sharePct}%</span>
                      {hasChildren ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          className={`w-3 h-3 text-ink-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : <span className="w-3" />}
                    </div>
                  </button>
                  {isExpanded && hasChildren && (
                    <div className="pl-6 pb-1 space-y-0.5">
                      {activeChildren.map(child => (
                        <button
                          type="button"
                          key={child.id}
                          onClick={() => setDrill({ categoryId: child.id, title: child.name })}
                          className="w-full flex items-center justify-between text-sm py-0.5 px-1 -mx-1 rounded-lg text-left hover:bg-inset transition-colors"
                        >
                          <span className="text-ink-3">{child.name}</span>
                          <span className="text-ink-2 tabular-nums">¥{childTotals[child.id].toLocaleString()}</span>
                        </button>
                      ))}
                      {directAmount > 0 && (
                        <button
                          type="button"
                          onClick={() => setDrill({ categoryId: parentId, title: `${parentName}（全般）` })}
                          className="w-full flex items-center justify-between text-sm py-0.5 px-1 -mx-1 rounded-lg text-left hover:bg-inset transition-colors"
                        >
                          <span className="text-ink-4">{parentName}（全般）</span>
                          <span className="text-ink-3 tabular-nums">¥{directAmount.toLocaleString()}</span>
                        </button>
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
              className={`text-xs px-3 py-1 rounded border ${chartMode === 'parent' ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-400/30' : 'text-ink-3 border-line'}`}
              onClick={() => setChartMode('parent')}
            >
              大分類
            </button>
            <button
              className={`text-xs px-3 py-1 rounded border ${chartMode === 'child' ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-400/30' : 'text-ink-3 border-line'}`}
              onClick={() => setChartMode('child')}
            >
              小分類
            </button>
          </div>
          {(() => {
            const childEntries: { id: string; name: string; amount: number; color: string }[] = []
            for (const parentId of sortedParentIds) {
              const parentName = parentId === '__uncategorized__'
                ? '未分類'
                : (parentCategories.find(c => c.id === parentId)?.name ?? '未分類')
              const children = categories.filter(c => c.parent_id === parentId)
              const activeChildren = children.filter(c => childTotals[c.id])
              if (activeChildren.length > 0) {
                for (const child of activeChildren) {
                  childEntries.push({ id: child.id, name: child.name, amount: childTotals[child.id], color: childCategoryColor(child.id, categories) })
                }
                const childSum = activeChildren.reduce((s, c) => s + childTotals[c.id], 0)
                const direct = parentTotals[parentId] - childSum
                if (direct > 0) {
                  childEntries.push({ id: `${parentId}__direct`, name: `${parentName}（全般）`, amount: direct, color: generalCategoryColor(parentId, categories) })
                }
              } else {
                childEntries.push({ id: parentId, name: parentName, amount: parentTotals[parentId], color: parentCategoryColor(parentId, categories) })
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
                  color: parentCategoryColor(parentId, categories),
                }))
              : childEntries

            return (
              <>
                {entries.length === 1 ? (
                  <svg viewBox="0 0 200 200" width="100%" height="auto">
                    <circle cx={cx} cy={cy} r={r} fill={entries[0].color} />
                  </svg>
                ) : (
                  <svg viewBox="0 0 200 200" width="100%" height="auto">
                    {(() => {
                      let cumAngle = -Math.PI / 2
                      return entries.map((entry) => {
                        const sliceAngle = (entry.amount / grandTotal) * 2 * Math.PI
                        const startAngle = cumAngle
                        const endAngle = cumAngle + sliceAngle
                        cumAngle = endAngle

                        const x1 = cx + r * Math.cos(startAngle)
                        const y1 = cy + r * Math.sin(startAngle)
                        const x2 = cx + r * Math.cos(endAngle)
                        const y2 = cy + r * Math.sin(endAngle)
                        const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0
                        const color = entry.color

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
                  {entries.map((entry) => {
                    const color = entry.color
                    const pct = ((entry.amount / grandTotal) * 100).toFixed(1)
                    return (
                      <div key={entry.id} className="flex items-center gap-2 text-sm">
                        <span className="inline-block rounded-sm flex-shrink-0" style={{ width: 12, height: 12, backgroundColor: color }} />
                        <span className="text-ink-2">{entry.name}</span>
                        <span className="text-ink-4 ml-auto tabular-nums">¥{entry.amount.toLocaleString()} ({pct}%)</span>
                      </div>
                    )
                  })}
                </div>
              </>
            )
          })()}
        </div>
      )}
      {drill && (
        <CategoryDrilldownModal
          title={drill.title}
          items={collectExpensesByCategory(receipts, drill.categoryId)}
          memberNameById={memberNameById}
          onSelectExpense={(expense) => {
            setDrill(null)
            onEditExpense(expense)
          }}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  )
}
