import { useState } from 'react'
import type { Expense, Category } from '../lib/supabase'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { ModalShell } from './ModalShell'
import { CategorySelect } from './CategorySelect'
import { resolveInitialCategoryIds } from '../lib/format'
import { parsePositiveInt, FORM_ERROR_MESSAGES } from '../lib/validation'

type Props = {
  expense: Expense
  members: string[]
  categories: Category[]
  onUpdate: (id: string, input: Omit<Expense, 'id' | 'created_at'>) => Promise<void>
  onUpsertRule: (keyword: string, categoryId: string) => void
  onDeleteRule: (keyword: string) => void
  onClose: () => void
}

export function EditExpenseModal({ expense, members, categories, onUpdate, onUpsertRule, onDeleteRule, onClose }: Props) {
  const { parentId, childId } = resolveInitialCategoryIds(categories, expense.category_id)

  const [paidBy, setPaidBy] = useState(expense.paid_by)
  const [description, setDescription] = useState(expense.description)
  const [amount, setAmount] = useState(String(expense.amount))
  const [parentCategoryId, setParentCategoryId] = useState(parentId)
  const [childCategoryId, setChildCategoryId] = useState(childId)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEscapeKey(onClose)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!paidBy) { setError(FORM_ERROR_MESSAGES.invalidPaidBy); return }
    if (!description.trim()) { setError(FORM_ERROR_MESSAGES.invalidDescription); return }
    const result = parsePositiveInt(amount)
    if (!result) { setError(FORM_ERROR_MESSAGES.invalidAmount); return }
    const effectiveCategoryId = childCategoryId || parentCategoryId || null
    setSubmitting(true)
    setError(null)
    try {
      await onUpdate(expense.id, { paid_by: paidBy, description: description.trim(), amount: result.validatedAmount, category_id: effectiveCategoryId, receipt_id: expense.receipt_id })
      // カテゴリーを訂正したら品名→カテゴリーを訂正メモリに反映する。
      if (effectiveCategoryId !== expense.category_id) {
        const desc = description.trim()
        if (effectiveCategoryId) onUpsertRule(desc, effectiveCategoryId)
        else onDeleteRule(desc)
      }
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell onClose={onClose} className="overflow-hidden">
      <h2 className="text-lg font-semibold text-ink mb-5">立替を編集</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink-2 mb-2">支払者</label>
          <div className="flex gap-4">
            {members.map((m) => (
              <label key={m} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paidBy"
                  value={m}
                  checked={paidBy === m}
                  onChange={() => setPaidBy(m)}
                  className="accent-indigo-500"
                />
                <span className="text-sm text-ink-2">{m}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1">内容</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            className="field-input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1">金額（円）</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={1}
            step={1}
            required
            className="field-input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1">カテゴリー</label>
          <CategorySelect
            categories={categories}
            parentCategoryId={parentCategoryId}
            childCategoryId={childCategoryId}
            onParentChange={(parentId, firstChildId) => { setParentCategoryId(parentId); setChildCategoryId(firstChildId) }}
            onChildChange={setChildCategoryId}
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1 py-2"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary flex-1 py-2"
          >
            {submitting ? '更新中…' : '更新'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
