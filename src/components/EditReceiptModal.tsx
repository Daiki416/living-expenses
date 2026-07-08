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
          <div className="w-full overflow-hidden rounded-lg">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="field-input min-w-0 appearance-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">店舗名</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="field-input"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>
      <div className="flex gap-3 mt-5">
        <button
          type="button"
          onClick={onClose}
          className="btn-secondary flex-1 py-2"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !description.trim()}
          className="btn-primary flex-1 py-2"
        >
          {submitting ? '保存中…' : '保存'}
        </button>
      </div>
    </ModalShell>
  )
}
