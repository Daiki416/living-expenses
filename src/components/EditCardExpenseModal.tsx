import { useState } from 'react'
import type { CardExpense, Category } from '../lib/supabase'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { ModalShell } from './ModalShell'

type Props = {
  cardExpense: CardExpense
  categories: Category[]
  onUpdate: (id: string, input: Omit<CardExpense, 'id' | 'created_at'>) => Promise<void>
  onClose: () => void
}

export function EditCardExpenseModal({ cardExpense, categories, onUpdate, onClose }: Props) {
  const [date, setDate] = useState(cardExpense.date)
  const [description, setDescription] = useState(cardExpense.description)
  const [amount, setAmount] = useState(String(cardExpense.amount))
  const [categoryId, setCategoryId] = useState(cardExpense.category_id ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEscapeKey(onClose)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsed = Number(amount)
    if (!date) { setError('日付を入力してください'); return }
    if (!description.trim()) { setError('内容を入力してください'); return }
    if (!Number.isInteger(parsed) || parsed <= 0) { setError('金額は1以上の整数で入力してください'); return }
    setSubmitting(true)
    setError(null)
    try {
      await onUpdate(cardExpense.id, { date, description: description.trim(), amount: parsed, category_id: categoryId || null })
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <ModalShell onClose={onClose} className="overflow-hidden">
      <h2 className="text-lg font-semibold text-gray-800 mb-5">クレカ明細を編集</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">日付</label>
          <div className="w-full overflow-hidden rounded-lg">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full min-w-0 appearance-none border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

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
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          >
            <option value="">未分類</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
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
