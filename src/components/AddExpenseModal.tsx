import { useEffect, useState } from 'react'
import type { Expense } from '../lib/supabase'

type Props = {
  members: string[]
  defaultDate: string
  onAdd: (input: Omit<Expense, 'id' | 'created_at'>) => Promise<void>
  onClose: () => void
}

export function AddExpenseModal({ members, defaultDate, onAdd, onClose }: Props) {
  const [date, setDate] = useState(defaultDate)
  const [paidBy, setPaidBy] = useState(members[0] ?? '')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!members.includes(paidBy)) setPaidBy(members[0] ?? '')
  }, [members, paidBy])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsed = Number(amount)
    if (!date) { setError('日付を入力してください'); return }
    if (!paidBy) { setError('支払者を選択してください'); return }
    if (!description.trim()) { setError('内容を入力してください'); return }
    if (!Number.isInteger(parsed) || parsed <= 0) { setError('金額は1以上の整数で入力してください'); return }
    setSubmitting(true)
    setError(null)
    try {
      await onAdd({ date, paid_by: paidBy, description: description.trim(), amount: parsed })
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-800 mb-5">立て替え追加</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">日付</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
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
              placeholder="例：スーパー"
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
              placeholder="3200"
              min={1}
              step={1}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
              {submitting ? '追加中…' : '追加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
