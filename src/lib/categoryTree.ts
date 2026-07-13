import type { Category } from './supabase'

// 葉（子を持たないカテゴリー）のID集合を返す。
// 子カテゴリーはもちろん、旧データの childless親（子を持たない親）も葉として扱う。
export function leafCategoryIds(categories: Category[]): Set<string> {
  const hasChild = new Set<string>()
  for (const c of categories) {
    if (c.parent_id !== null) hasChild.add(c.parent_id)
  }
  return new Set(categories.filter(c => !hasChild.has(c.id)).map(c => c.id))
}

// 指定IDが葉（子を持たない）かどうか。存在しないIDは false。
export function isLeafCategory(id: string, categories: Category[]): boolean {
  if (!categories.some(c => c.id === id)) return false
  return !categories.some(c => c.parent_id === id)
}

// 子カテゴリー childId を削除した結果、その親が子ゼロになるなら親IDを返す（ならない/対象外は null）。
export function shouldDeleteParentAfterChildRemoval(categories: Category[], childId: string): string | null {
  const child = categories.find(c => c.id === childId)
  if (!child || child.parent_id === null) return null
  const siblingCount = categories.filter(c => c.parent_id === child.parent_id).length
  return siblingCount <= 1 ? child.parent_id : null
}

export type CategoryValidation = { ok: true } | { ok: false; message: string }

// 新規「大分類＋最初の小分類」の入力を検証する。両名必須（trim後空でない）・各100文字以内。
export function validateNewParentWithChild(parentName: string, childName: string): CategoryValidation {
  const parent = parentName.trim()
  const child = childName.trim()
  if (!parent) return { ok: false, message: '大分類名を入力してください' }
  if (!child) return { ok: false, message: '小分類名を入力してください' }
  if (parent.length > 100) return { ok: false, message: '大分類名は100文字以内で入力してください' }
  if (child.length > 100) return { ok: false, message: '小分類名は100文字以内で入力してください' }
  return { ok: true }
}
