import { useState } from 'react'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { ModalShell } from './ModalShell'

type Props = {
  receiptId: string
  initialDescription: string
  initialDate: string
  onUpdate: (id: string, input: { description: string; date: string }) => Promise<void>
  onClose: () => void
}

export function EditReceiptModal({ receiptId, initialDescription, initialDate, onUpdate, onClose }: Props) {
  const [description, setDescription] = useState(initialDescription)
  const [date, setDate] = useState(initialDate)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEscapeKey(onClose)

  async function handleSubmit() {
    if (!description.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await onUpdate(receiptId, { description: description.trim(), date })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <h2 className="text-lg font-semibold text-gray-800 mb-5">レシート編集</h2>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">日付</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">店舗名</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>
      <div className="flex gap-3 mt-5">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !description.trim()}
          className="flex-1 bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-60 transition"
        >
          {submitting ? '保存中…' : '保存'}
        </button>
      </div>
    </ModalShell>
  )
}
