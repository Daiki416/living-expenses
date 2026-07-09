import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useMonthlyTrend } from '../hooks/useMonthlyTrend'
import type { Category } from '../lib/supabase'
import { CHART_COLORS } from '../lib/chartColors'

type Props = {
  categories: Category[]
  onClose: () => void
}

function calcDefaultStartYM(currentYM: string): string {
  const [y, m] = currentYM.split('-').map(Number)
  const prevM = m - 2
  if (prevM <= 0) {
    return `${y - 1}-${String(12 + prevM).padStart(2, '0')}`
  }
  return `${y}-${String(prevM).padStart(2, '0')}`
}

export function MonthlyTrendView({ categories, onClose }: Props) {
  const now = new Date()
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const defaultStartYM = calcDefaultStartYM(currentYM)

  const [startYM, setStartYM] = useState(defaultStartYM)
  const [endYM, setEndYM] = useState(currentYM)
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null)
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null)

  const { monthlyData, loading, error } = useMonthlyTrend(startYM, endYM)

  const parentCategories = categories.filter(c => c.parent_id === null)
  const childCategories = (parentId: string) => categories.filter(c => c.parent_id === parentId)
  const categoryName = (id: string) => categories.find(c => c.id === id)?.name ?? '未分類'

  // 表示モード別の集計
  let activeIds: string[] = []
  let chartData: Record<string, unknown>[] = []

  if (selectedParentId === null) {
    // 全大分類モード
    const idSet = new Set<string>()
    for (const point of monthlyData) {
      for (const [catId, amount] of Object.entries(point.totals)) {
        if (amount > 0) {
          if (catId === '__uncategorized__') {
            idSet.add('__uncategorized__')
          } else {
            const cat = categories.find(c => c.id === catId)
            const parentId = cat?.parent_id ?? cat?.id
            if (parentId) idSet.add(parentId)
          }
        }
      }
    }
    activeIds = [...idSet]

    chartData = monthlyData.map(point => {
      const entry: Record<string, unknown> = { label: point.label }
      for (const id of activeIds) {
        entry[id] = 0
      }
      for (const [catId, amount] of Object.entries(point.totals)) {
        if (catId === '__uncategorized__') {
          entry['__uncategorized__'] = (entry['__uncategorized__'] as number ?? 0) + amount
        } else {
          const cat = categories.find(c => c.id === catId)
          const parentId = cat?.parent_id ?? cat?.id
          if (parentId && parentId in entry) {
            entry[parentId] = (entry[parentId] as number) + amount
          }
        }
      }
      return entry
    })
  } else if (selectedChildId === null) {
    // 中分類積み上げモード
    const children = childCategories(selectedParentId)
    const childIds = children.map(c => c.id)
    const idSet = new Set<string>()
    for (const point of monthlyData) {
      for (const [catId, amount] of Object.entries(point.totals)) {
        if (amount > 0 && childIds.includes(catId)) {
          idSet.add(catId)
        }
      }
    }
    activeIds = [...idSet]

    chartData = monthlyData.map(point => {
      const entry: Record<string, unknown> = { label: point.label }
      for (const id of activeIds) {
        entry[id] = point.totals[id] ?? 0
      }
      return entry
    })
  } else {
    // 単一中分類モード
    activeIds = [selectedChildId]
    chartData = monthlyData.map(point => ({
      label: point.label,
      [selectedChildId]: point.totals[selectedChildId] ?? 0,
    }))
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-xl mx-auto px-4 py-6">

        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={onClose}
            className="text-indigo-500 hover:text-indigo-700 text-sm font-medium transition-colors"
          >
            ← 戻る
          </button>
          <h2 className="text-lg font-bold text-ink">支出推移</h2>
          <div className="w-12" />
        </div>

        {/* 月範囲セレクター */}
        <div className="card px-4 py-3 mb-4 flex items-center gap-2">
          <input
            type="month"
            value={startYM}
            onChange={e => setStartYM(e.target.value)}
            max={endYM}
            className="field-input w-auto px-2 py-1 text-sm"
          />
          <span className="text-ink-4">〜</span>
          <input
            type="month"
            value={endYM}
            onChange={e => setEndYM(e.target.value)}
            min={startYM}
            className="field-input w-auto px-2 py-1 text-sm"
          />
        </div>

        {/* カテゴリーフィルター */}
        <div className="card px-4 py-3 mb-4">
          <div className="flex flex-wrap gap-1.5 mb-2">
            <button
              onClick={() => { setSelectedParentId(null); setSelectedChildId(null) }}
              className={`px-3 py-1 text-xs font-medium ${
                selectedParentId === null ? 'chip-active' : 'chip'
              }`}
            >
              全体
            </button>
            {parentCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => { setSelectedParentId(cat.id); setSelectedChildId(null) }}
                className={`px-3 py-1 text-xs font-medium ${
                  selectedParentId === cat.id ? 'chip-active' : 'chip'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {selectedParentId !== null && (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {childCategories(selectedParentId).map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedChildId(selectedChildId === cat.id ? null : cat.id)}
                  className={`px-3 py-1 text-xs font-medium ${
                    selectedChildId === cat.id ? 'chip-active' : 'chip'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* グラフ */}
        <div className="card px-4 py-4">
          {loading ? (
            <div className="text-center text-ink-4 py-8 text-sm">読み込み中…</div>
          ) : error ? (
            <div className="text-center text-red-400 py-8 text-sm">エラー: {error}</div>
          ) : (() => {
            const maxVal = chartData.length > 0
              ? Math.max(...chartData.map(d =>
                  activeIds.reduce((s, id) => s + ((d[id] as number) ?? 0), 0)
                ), 0)
              : 0
            const useMan = maxVal >= 10000
            const divisor = useMan ? 10000 : 1000
            const unitSuffix = useMan ? '万' : '千'

            // 単位系でキリのいいステップ幅を選び、等間隔 tick を生成する
            const NICE_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]
            const TARGET_TICKS = 5
            const maxInUnit = maxVal / divisor
            const rawStep = maxInUnit / (TARGET_TICKS - 1)
            const niceStep = NICE_STEPS.find(s => s >= rawStep) ?? NICE_STEPS[NICE_STEPS.length - 1]
            const tickCountN = Math.ceil(maxInUnit / niceStep) + 1
            const ticks = Array.from({ length: tickCountN }, (_, i) => Math.round(i * niceStep * divisor))

            const formatTick = (v: number) => {
              if (v === 0) return '0'
              const n = v / divisor
              return Number.isInteger(n) ? `${n}${unitSuffix}` : `${n.toFixed(1)}${unitSuffix}`
            }
            return (
              <>
                <p className="text-xs text-ink-4 mb-1">単位: 円</p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis
                      ticks={ticks}
                      domain={[0, ticks[ticks.length - 1]]}
                      tickFormatter={formatTick}
                      tick={{ fontSize: 11 }}
                      width={40}
                    />
                    <Tooltip formatter={(v) => typeof v === 'number' ? `¥${v.toLocaleString()}` : ''} />
                    <Legend />
                    {activeIds.map((id, i) => (
                      <Bar
                        key={id}
                        dataKey={id}
                        stackId="a"
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                        name={id === '__uncategorized__' ? '未分類' : categoryName(id)}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </>
            )
          })()}
        </div>

      </div>
    </div>
  )
}
