import { createClient } from '@supabase/supabase-js'
import { MESSAGES } from '../config/messages'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(MESSAGES.config.missingSupabaseEnv)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Expense = {
  id: string
  paid_by: string | null
  description: string
  amount: number
  category_id: string | null
  receipt_id: string
  created_at: string
}

export type Member = {
  id: string
  name: string
  monthly_budget: number
  created_at: string
}

export type Category = {
  id: string
  name: string
  parent_id: string | null
  sort_order: number
  created_at: string
}

export type ReceiptKind = 'advance' | 'card'

export type Receipt = {
  id: string
  date: string
  description: string
  kind: ReceiptKind
  created_at: string
}

export type CategoryRule = {
  id: string
  keyword: string
  category_id: string
  created_at: string
}

export type ReceiptWithExpenses = Receipt & { expenses: Expense[] }
