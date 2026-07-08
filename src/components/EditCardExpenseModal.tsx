import { useState } from 'react'
import type { CardExpense, Category } from '../lib/supabase'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { ModalShell } from './ModalShell'
import { CategorySelect } from './CategorySelect'
import { resolveInitialCategoryIds } from '../lib/format'
import { parsePositiveInt, FORM_ERROR_MESSAGES } from '../lib/validation'

type Props = {
  cardExpense: CardExpense
  categories: Category[]
  onUpdate: (id: string, input: Omit<CardExpense, 'id' | 'created_at'>) => Promise<void>
  onUpsertRule: (keyword: string, categoryId: string) => void
  onDeleteRule: (keyword: string) => void
  onClose: () => void
}

export function EditCardExpenseModal({ cardExpense, categories, onUpdate, onUpsertRule, onDeleteRule, onClose }: Props) {
  const { parentId, childId } = resolveInitialCategoryIds(categories, cardExpense.category_id)

  const [description, setDescription] = useState(cardExpense.description)
  const [amount, setAmount] = useState(String(cardExpense.amount))
  const [parentCategoryId, setParentCategoryId] = useState(parentId)
  const [childCategoryId, setChildCategoryId] = useState(childId)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEscapeKey(onClose)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!description.trim()) { setError(FORM_ERROR_MESSAGES.invalidDescription); return }
    const result = parsePositiveInt(amount)
    if (!result) { setError(FORM_ERROR_MESSAGES.invalidAmount); return }
    const effectiveCategoryId = childCategoryId || parentCategoryId || null
    setSubmitting(true)
    setError(null)
    try {
      await onUpdate(cardExpense.id, { description: description.trim(), amount: result.validatedAmount, category_id: effectiveCategoryId, receipt_id: cardExpense.receipt_id })
      // カテゴリーを訂正したら品名→カテゴリーを訂正メモリに反映する。
      if (effectiveCategoryId !== cardExpense.category_id) {
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
      <h2 className="text-lg font-semibold text-gray-800 mb-5">クレカ明細を編集</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">内容</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">金額（円）</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={1}
            step={1}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">カテゴリー</label>
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
            className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-60 transition"
          >
            {submitting ? '更新中…' : '更新'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
