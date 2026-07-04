import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を .env に設定してください')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Expense = {
  id: string
  paid_by: string
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
  created_at: string
}

export type CardExpense = {
  id: string
  description: string
  amount: number
  category_id: string | null
  receipt_id: string
  created_at: string
}

export type ExpenseReceipt = {
  id: string
  date: string
  description: string
  created_at: string
}

export type CardExpenseReceipt = {
  id: string
  date: string
  description: string
  created_at: string
}

export type ExpenseReceiptWithExpenses = ExpenseReceipt & { expenses: Expense[] }

export type CardExpenseReceiptWithCardExpenses = CardExpenseReceipt & { card_expenses: CardExpense[] }
