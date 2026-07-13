import { useState } from 'react'
import type { Expense, Category } from '../lib/supabase'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { ModalShell } from './ModalShell'
import { CategoryPicker } from './CategoryPicker'
import { resolveCategoryLabel } from '../lib/format'
import { resolveCategoryColor } from '../lib/categoryColors'
import { isLeafCategory } from '../lib/categoryTree'
import { parsePositiveInt, FORM_ERROR_MESSAGES } from '../lib/validation'

type Props = {
  expense: Expense
  categories: Category[]
  onUpdate: (id: string, input: Omit<Expense, 'id' | 'created_at'>) => Promise<void>
  onUpsertRule: (keyword: string, categoryId: string) => void
  onDeleteRule: (keyword: string) => void
  onClose: () => void
}

export function EditExpenseModal({ expense, categories, onUpdate, onUpsertRule, onDeleteRule, onClose }: Props) {
  const [description, setDescription] = useState(expense.description)
  const [amount, setAmount] = useState(String(expense.amount))
  // 葉（小分類 or childless親）のみ選択可のため、非葉IDで保存された旧データは未分類に寄せる。
  const [categoryId, setCategoryId] = useState<string | null>(
    expense.category_id && isLeafCategory(expense.category_id, categories) ? expense.category_id : null
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEscapeKey(onClose)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!description.trim()) { setError(FORM_ERROR_MESSAGES.invalidDescription); return }
    const result = parsePositiveInt(amount)
    if (!result) { setError(FORM_ERROR_MESSAGES.invalidAmount); return }
    const effectiveCategoryId = categoryId
    setSubmitting(true)
    setError(null)
    try {
      await onUpdate(expense.id, { description: description.trim(), amount: result.validatedAmount, category_id: effectiveCategoryId, receipt_id: expense.receipt_id })
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
      <h2 className="text-lg font-semibold text-ink mb-5">明細を編集</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
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
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-sm ${
              resolveCategoryLabel(categoryId, categories) ? 'text-ink-2' : 'text-ink-4'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: resolveCategoryColor(categoryId, categories) ?? '#d1d5db' }} />
            {resolveCategoryLabel(categoryId, categories) || '未分類'}
          </button>
          {pickerOpen && (
            <CategoryPicker
              categories={categories}
              selectedId={categoryId}
              onSelect={(id) => { setCategoryId(id); setPickerOpen(false) }}
              onClose={() => setPickerOpen(false)}
            />
          )}
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
