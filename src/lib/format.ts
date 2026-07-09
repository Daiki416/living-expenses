import type { Category } from './supabase'

export function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`
}

export function splitDateChip(dateStr: string): { month: string; day: string } {
  const [, m, d] = dateStr.split('-')
  return { month: `${parseInt(m, 10)}月`, day: `${parseInt(d, 10)}` }
}

export function resolveCategoryLabel(categoryId: string | null, categories: Category[]): string {
  if (!categoryId) return ''
  const cat = categories.find(c => c.id === categoryId)
  if (!cat) return ''
  if (cat.parent_id) {
    const parent = categories.find(c => c.id === cat.parent_id)
    return parent ? `${parent.name} > ${cat.name}` : cat.name
  }
  return cat.name
}

export function resolveInitialCategoryIds(categories: Category[], categoryId: string | null): { parentId: string; childId: string } {
  if (!categoryId) return { parentId: '', childId: '' }
  const cat = categories.find(c => c.id === categoryId)
  if (!cat) return { parentId: '', childId: '' }
  if (cat.parent_id) return { parentId: cat.parent_id, childId: cat.id }
  return { parentId: cat.id, childId: '' }
}
