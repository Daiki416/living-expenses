import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を .env に設定してください')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Expense = {
  id: string
  date: string
  paid_by: string
  description: string
  amount: number
  category_id: string | null
  created_at: string
}

export type Member = {
  id: string
  name: string
  created_at: string
}

export type Category = {
  id: string
  name: string
  created_at: string
}

export type CardExpense = {
  id: string
  date: string
  description: string
  amount: number
  category_id: string | null
  created_at: string
}
