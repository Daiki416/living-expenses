import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useMonthlyTrend } from '../hooks/useMonthlyTrend'
import type { Category } from '../lib/supabase'

type Props = {
  categories: Category[]
  onClose: () => void
}

const CHART_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-6">

        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={onClose}
            className="text-indigo-500 hover:text-indigo-700 text-sm font-medium transition"
          >
            ← 戻る
          </button>
          <h2 className="text-lg font-bold text-gray-800">支出推移</h2>
          <div className="w-12" />
        </div>

        {/* 月範囲セレクター */}
        <div className="bg-white rounded-xl shadow-sm px-4 py-3 mb-4 flex items-center gap-2">
          <input
            type="month"
            value={startYM}
            onChange={e => setStartYM(e.target.value)}
            max={endYM}
            className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <span className="text-gray-400">〜</span>
          <input
            type="month"
            value={endYM}
            onChange={e => setEndYM(e.target.value)}
            min={startYM}
            className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* カテゴリーフィルター */}
        <div className="bg-white rounded-xl shadow-sm px-4 py-3 mb-4">
          <div className="flex flex-wrap gap-1.5 mb-2">
            <button
              onClick={() => { setSelectedParentId(null); setSelectedChildId(null) }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                selectedParentId === null
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              全体
            </button>
            {parentCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => { setSelectedParentId(cat.id); setSelectedChildId(null) }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  selectedParentId === cat.id
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:bg-gray-100'
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
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    selectedChildId === cat.id
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* グラフ */}
        <div className="bg-white rounded-xl shadow-sm px-4 py-4">
          {loading ? (
            <div className="text-center text-gray-400 py-8 text-sm">読み込み中…</div>
          ) : error ? (
            <div className="text-center text-red-400 py-8 text-sm">エラー: {error}</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis
                  tickFormatter={(v: number) => v === 0 ? '0' : `${Math.round(v / 10000)}万`}
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
                    fill={CHART_COLORS[i % 8]}
                    name={id === '__uncategorized__' ? '未分類' : categoryName(id)}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>
    </div>
  )
}
