import { useEffect, useState } from 'react'
import type { Expense, Category } from '../lib/supabase'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { ModalShell } from './ModalShell'

type Props = {
  expense: Expense
  members: string[]
  categories: Category[]
  onUpdate: (id: string, input: Omit<Expense, 'id' | 'created_at'>) => Promise<void>
  onClose: () => void
}

export function EditExpenseModal({ expense, members, categories, onUpdate, onClose }: Props) {
  const existingCat = categories.find(c => c.id === expense.category_id)
  const initialParentId = existingCat
    ? (existingCat.parent_id ?? existingCat.id)
    : ''
  const initialChildId = existingCat?.parent_id ? existingCat.id : ''

  const [date, setDate] = useState(expense.date)
  const [paidBy, setPaidBy] = useState(expense.paid_by)
  const [description, setDescription] = useState(expense.description)
  const [amount, setAmount] = useState(String(expense.amount))
  const [parentCategoryId, setParentCategoryId] = useState(initialParentId)
  const [childCategoryId, setChildCategoryId] = useState(initialChildId)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parentCategories = categories.filter(c => c.parent_id === null)
  const childCategories = categories.filter(c => c.parent_id === parentCategoryId)

  useEffect(() => {
    if (!members.includes(paidBy)) setPaidBy(members[0] ?? '')
  }, [members, paidBy])

  useEscapeKey(onClose)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsed = Number(amount)
    if (!date) { setError('日付を入力してください'); return }
    if (!paidBy) { setError('支払者を選択してください'); return }
    if (!description.trim()) { setError('内容を入力してください'); return }
    if (!Number.isInteger(parsed) || parsed <= 0) { setError('金額は1以上の整数で入力してください'); return }
    const effectiveCategoryId = childCategoryId || parentCategoryId || null
    setSubmitting(true)
    setError(null)
    try {
      await onUpdate(expense.id, { date, paid_by: paidBy, description: description.trim(), amount: parsed, category_id: effectiveCategoryId })
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <ModalShell onClose={onClose} className="overflow-hidden">
      <h2 className="text-lg font-semibold text-gray-800 mb-5">立替を編集</h2>

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
          <label className="block text-sm font-medium text-gray-600 mb-2">支払者</label>
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
                <span className="text-sm text-gray-700">{m}</span>
              </label>
            ))}
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
            value={parentCategoryId}
            onChange={(e) => { setParentCategoryId(e.target.value); setChildCategoryId('') }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          >
            <option value="">未分類</option>
            {parentCategories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {childCategories.length > 0 && (
            <select
              value={childCategoryId}
              onChange={(e) => setChildCategoryId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white mt-2"
            >
              <option value="">{parentCategories.find(c => c.id === parentCategoryId)?.name}（全般）</option>
              {childCategories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
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
