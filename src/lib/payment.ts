import type { ReceiptKind } from './supabase'
import { EXPENSE_KIND } from '../config/classifications'

// 支払者（paid_by）からレシートの kind を導出する。
// メンバー名が入っていれば立替、null / 空文字（falsy）ならクレカ。
export function deriveReceiptKind(paidBy: string | null): ReceiptKind {
  return paidBy ? EXPENSE_KIND.ADVANCE : EXPENSE_KIND.CARD
}
