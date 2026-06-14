import type { Category } from './supabase'

export function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`
}

export function resolveInitialCategoryIds(categories: Category[], categoryId: string | null): { parentId: string; childId: string } {
  if (!categoryId) return { parentId: '', childId: '' }
  const cat = categories.find(c => c.id === categoryId)
  if (!cat) return { parentId: '', childId: '' }
  if (cat.parent_id) return { parentId: cat.parent_id, childId: cat.id }
  return { parentId: cat.id, childId: '' }
}
