import { useEffect, useState } from 'react'
import { supabase, type Category } from '../lib/supabase'

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
      const { data, error } = await supabase.from('categories').select('*').order('created_at')
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
    const { error } = await supabase.from('categories').insert({ name, parent_id: parentId ?? null })
    if (error) throw new Error(error.message)
    setRefetchKey(k => k + 1)
  }

  async function deleteCategory(id: string) {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setRefetchKey(k => k + 1)
  }

  return { categories, loading, error, addCategory, deleteCategory }
}
