import { useEffect, useState } from 'react'
import { supabase, type Member } from '../lib/supabase'

export function useMembers() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refetchKey, setRefetchKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase.from('members').select('*').order('created_at')
      if (cancelled) return
      if (error) {
        setError(error.message)
      } else {
        setMembers(data ?? [])
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [refetchKey])

  async function addMember(name: string) {
    const { error } = await supabase.from('members').insert({ name })
    if (error) throw new Error(error.message)
    setRefetchKey(k => k + 1)
  }

  async function deleteMember(id: string) {
    const { error } = await supabase.from('members').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setRefetchKey(k => k + 1)
  }

  async function updateMemberBudget(id: string, budget: number) {
    const { error } = await supabase.from('members').update({ monthly_budget: budget }).eq('id', id)
    if (error) throw new Error(error.message)
    setRefetchKey(k => k + 1)
  }

  return { members, loading, error, addMember, deleteMember, updateMemberBudget }
}
