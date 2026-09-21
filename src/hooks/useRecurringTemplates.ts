import { useEffect, useState } from 'react'
import { supabase, type RecurringTemplateWithItems } from '../lib/supabase'
import type { RecurringItemInput, RecurringTemplateInput } from '../lib/recurring'

function toItemsPayload(items: RecurringItemInput[]) {
  return items.map((item, i) => ({
    description: item.description,
    amount: item.amount,
    category_id: item.categoryId,
    sort_order: i,
  }))
}

export function useRecurringTemplates() {
  const [templates, setTemplates] = useState<RecurringTemplateWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refetchKey, setRefetchKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('recurring_templates')
        .select('*, recurring_template_items(*)')
        .order('created_at')
      if (cancelled) return
      if (error) {
        setError(error.message)
      } else {
        setTemplates((data as RecurringTemplateWithItems[]) ?? [])
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [refetchKey])

  async function addTemplate(input: RecurringTemplateInput) {
    const { error } = await supabase.rpc('add_recurring_template', {
      p_description: input.description,
      p_kind: input.kind,
      p_paid_by_member_id: input.paidByMemberId,
      p_day_of_month: input.dayOfMonth,
      p_items: toItemsPayload(input.items),
    })
    if (error) throw new Error(error.message)
    setRefetchKey(k => k + 1)
  }

  async function updateTemplate(id: string, input: RecurringTemplateInput) {
    const { error } = await supabase.rpc('update_recurring_template', {
      p_id: id,
      p_description: input.description,
      p_kind: input.kind,
      p_paid_by_member_id: input.paidByMemberId,
      p_day_of_month: input.dayOfMonth,
      p_items: toItemsPayload(input.items),
    })
    if (error) throw new Error(error.message)
    setRefetchKey(k => k + 1)
  }

  async function deleteTemplate(id: string) {
    const { error } = await supabase.from('recurring_templates').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setRefetchKey(k => k + 1)
  }

  async function toggleTemplate(id: string, active: boolean) {
    const { error } = await supabase.from('recurring_templates').update({ active }).eq('id', id)
    if (error) throw new Error(error.message)
    setRefetchKey(k => k + 1)
  }

  return { templates, loading, error, addTemplate, updateTemplate, deleteTemplate, toggleTemplate }
}
