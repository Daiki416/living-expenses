import type { Category } from './supabase'

// 親カテゴリの色（色相を全体に散らした muted categorical パレット）
// sort_order 安定順のindexで割り当て。月やデータ並びに依存しない。
const PARENTS: { h: number; s: number; l: number }[] = [
  { h: 355, s: 60, l: 58 },
  { h: 28, s: 62, l: 55 },
  { h: 48, s: 58, l: 50 },
  { h: 150, s: 42, l: 45 },
  { h: 192, s: 52, l: 46 },
  { h: 218, s: 58, l: 56 },
  { h: 262, s: 48, l: 60 },
  { h: 318, s: 44, l: 58 },
]
const HUE_STEP = 13 // 子の色相ふり幅（親色相からのオフセット係数）
const L_STEP = 7 // 子の明度ふり幅
const L_MIN = 40
const L_MAX = 74

/** 未分類/未知ID用のニュートラルグレー */
export const UNCATEGORIZED_COLOR = 'hsl(228, 7%, 62%)'

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

// 色相を 0〜360 未満に正規化する（子の色相オフセットで負値・360超になり得るため）。
function normalizeHue(h: number): number {
  return ((h % 360) + 360) % 360
}

function parentForIndex(idx: number): { h: number; s: number; l: number } {
  return PARENTS[idx % PARENTS.length]
}

// 親カテゴリの安定順（sort_order 昇順→同値は id 昇順）。月やデータ並びに依存しない。
function sortedParents(categories: Category[]): Category[] {
  return categories
    .filter(c => c.parent_id === null)
    .sort((a, b) => (a.sort_order - b.sort_order) || a.id.localeCompare(b.id))
}

// 親カテゴリの安定色を返す（未知IDや __uncategorized__ はグレー）。必ず string を返す。
export function parentCategoryColor(parentId: string, categories: Category[]): string {
  const idx = sortedParents(categories).findIndex(p => p.id === parentId)
  if (idx < 0) return UNCATEGORIZED_COLOR
  const p = parentForIndex(idx)
  return `hsl(${p.h}, ${p.s}%, ${p.l}%)`
}

// 子カテゴリの安定色を返す。親と同じ色系統のまま、兄弟間で色相を少し回し明度をずらす。
export function childCategoryColor(childId: string, categories: Category[]): string {
  const child = categories.find(c => c.id === childId)
  if (!child || child.parent_id === null) return UNCATEGORIZED_COLOR
  const parents = sortedParents(categories)
  const parentIdx = parents.findIndex(p => p.id === child.parent_id)
  if (parentIdx < 0) return UNCATEGORIZED_COLOR
  const p = parentForIndex(parentIdx)
  const siblings = categories
    .filter(c => c.parent_id === child.parent_id)
    .sort((a, b) => (a.sort_order - b.sort_order) || a.id.localeCompare(b.id))
  const ci = siblings.findIndex(c => c.id === childId)
  const n = siblings.length
  const off = ci - (n - 1) / 2
  const h = normalizeHue(p.h + off * HUE_STEP)
  const l = clamp(Math.round(p.l + off * L_STEP), L_MIN, L_MAX)
  const childS = Math.max(0, p.s - 6)
  return `hsl(${h}, ${childS}%, ${l}%)`
}

// 「（全般）」用の色。親色相のくすませた低彩度版（子と被らないように）。
export function generalCategoryColor(parentId: string, categories: Category[]): string {
  const idx = sortedParents(categories).findIndex(p => p.id === parentId)
  if (idx < 0) return UNCATEGORIZED_COLOR
  const p = parentForIndex(idx)
  return `hsl(${p.h}, 18%, 60%)`
}

// categoryId が属する「親カテゴリ」の安定色を返す。
// categoryId が null / cat が見つからない場合は null を返す。
// cat は見つかるが親が categories に無い孤児の子の場合はグレー（UNCATEGORIZED_COLOR）。
export function resolveCategoryColor(categoryId: string | null, categories: Category[]): string | null {
  if (!categoryId) return null
  const cat = categories.find(c => c.id === categoryId)
  if (!cat) return null
  const parentId = cat.parent_id ?? cat.id
  return parentCategoryColor(parentId, categories)
}
