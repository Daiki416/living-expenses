import { useEffect, useState } from 'react'
import { supabase, type Category } from '../lib/supabase'
import { computeSortOrderUpdates } from '../lib/categoryOrder'

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refetchKey, setRefetchKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase.from('categories').select('*').order('sort_order').order('created_at')
      if (cancelled) return
      if (error) {
        setError(error.message)
      } else {
        setCategories(data ?? [])
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [refetchKey])

  async function addCategory(name: string, parentId?: string | null) {
    const scopeParentId = parentId ?? null
    // 新規カテゴリーは同一スコープの末尾に採番する（空スコープなら 0）。
    const maxOrder = categories
      .filter(c => c.parent_id === scopeParentId)
      .reduce((max, c) => Math.max(max, c.sort_order), -1)
    const { error } = await supabase
      .from('categories')
      .insert({ name, parent_id: scopeParentId, sort_order: maxOrder + 1 })
    if (error) throw new Error(error.message)
    setRefetchKey(k => k + 1)
  }

  async function deleteCategory(id: string) {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setRefetchKey(k => k + 1)
  }

  async function renameCategory(id: string, name: string) {
    const n = name.trim()
    if (!n || n.length > 100) return
    const { error } = await supabase.from('categories').update({ name: n }).eq('id', id)
    if (error) throw new Error(error.message)
    setRefetchKey(k => k + 1)
  }

  // orderedIds は1スコープ分（親同士、または同じ親の子同士）の並び順。
  // stale な現在値に依存しないよう、常に全件を index 通りに更新する。
  async function reorderCategory(orderedIds: string[]) {
    if (orderedIds.length === 0) return
    const updates = computeSortOrderUpdates(orderedIds)
    const results = await Promise.all(
      updates.map(u => supabase.from('categories').update({ sort_order: u.sort_order }).eq('id', u.id))
    )
    const failed = results.find(r => r.error)
    if (failed?.error) throw new Error(failed.error.message)
    setRefetchKey(k => k + 1)
  }

  return { categories, loading, error, addCategory, deleteCategory, renameCategory, reorderCategory }
}
