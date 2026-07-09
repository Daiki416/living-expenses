import type { Category } from './supabase'
import { CHART_COLORS } from './chartColors'

// categoryId が属する「親カテゴリ」の安定色を返す。
// 親の並び順は月やデータ並びに依存しない安定順（sort_order 昇順→同値は id 昇順）。
export function resolveCategoryColor(categoryId: string | null, categories: Category[]): string | null {
  if (!categoryId) return null
  const cat = categories.find(c => c.id === categoryId)
  if (!cat) return null
  const parentId = cat.parent_id ?? cat.id
  const parents = categories
    .filter(c => c.parent_id === null)
    .sort((a, b) => (a.sort_order - b.sort_order) || a.id.localeCompare(b.id))
  const idx = parents.findIndex(p => p.id === parentId)
  return idx < 0 ? null : CHART_COLORS[idx % CHART_COLORS.length]
}
