import type { ReceiptKind } from './supabase'
import { EXPENSE_KIND } from '../config/classifications'

// 支払者（メンバーID）からレシートの kind を導出する。
// メンバーIDが入っていれば立替、null / 空文字（falsy）ならクレカ。
export function deriveReceiptKind(paidByMemberId: string | null): ReceiptKind {
  return paidByMemberId ? EXPENSE_KIND.ADVANCE : EXPENSE_KIND.CARD
}
