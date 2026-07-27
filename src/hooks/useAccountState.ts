import { useEffect, useState } from 'react'
import { supabase, type AccountState } from '../lib/supabase'

function todayYYYYMMDD() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function useAccountState() {
  const [accountState, setAccountState] = useState<AccountState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refetchKey, setRefetchKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase.from('account_state').select('*').eq('id', true).maybeSingle()
      if (cancelled) return
      if (error) {
        setError(error.message)
      } else {
        setAccountState(data ?? null)
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [refetchKey])

  async function updateBalance(balance: number) {
    const { error } = await supabase
      .from('account_state')
      .upsert({ id: true, balance, balance_as_of: todayYYYYMMDD(), updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (error) throw new Error(error.message)
    setRefetchKey(k => k + 1)
  }

  async function updateNextCardDebit(next_card_debit: number) {
    const { error } = await supabase
      .from('account_state')
      .upsert({ id: true, next_card_debit, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (error) throw new Error(error.message)
    setRefetchKey(k => k + 1)
  }

  return { accountState, loading, error, updateBalance, updateNextCardDebit }
}
