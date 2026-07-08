import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, type CategoryRule } from '../lib/supabase'
import { normalizeKeyword } from '../lib/categoryRules'

export function useCategoryRules() {
  const [rules, setRules] = useState<CategoryRule[]>([])
  const [error, setError] = useState<string | null>(null)
  const [refetchKey, setRefetchKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setError(null)
      const { data, error } = await supabase.from('category_rules').select('*')
      if (cancelled) return
      if (error) {
        setError(error.message)
      } else {
        setRules(data ?? [])
      }
    })()
    return () => { cancelled = true }
  }, [refetchKey])

  // keyword はDB格納時点で正規化済みなのでそのままキーにする。
  const rulesMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const rule of rules) map.set(rule.keyword, rule.category_id)
    return map
  }, [rules])

  // 学習は副次機能のため、DBエラーは throw せず setError に留める。
  const upsertRule = useCallback((rawKeyword: string, categoryId: string) => {
    const keyword = normalizeKeyword(rawKeyword)
    if (!keyword || !categoryId) return
    ;(async () => {
      const { error } = await supabase
        .from('category_rules')
        .upsert({ keyword, category_id: categoryId }, { onConflict: 'keyword' })
      if (error) { setError(error.message); return }
      setRefetchKey(k => k + 1)
    })()
  }, [])

  const deleteRule = useCallback((rawKeyword: string) => {
    const keyword = normalizeKeyword(rawKeyword)
    if (!keyword) return
    ;(async () => {
      const { error } = await supabase.from('category_rules').delete().eq('keyword', keyword)
      if (error) { setError(error.message); return }
      setRefetchKey(k => k + 1)
    })()
  }, [])

  return { rulesMap, upsertRule, deleteRule, error }
}
