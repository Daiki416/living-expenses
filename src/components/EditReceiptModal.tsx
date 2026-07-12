import { useState } from 'react'
import type { Member, ReceiptKind } from '../lib/supabase'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { ModalShell } from './ModalShell'
import { MESSAGES } from '../config/messages'
import { EXPENSE_KIND_LABEL } from '../config/classifications'
import { deriveReceiptKind } from '../lib/payment'

type Props = {
  receiptId: string
  initialDescription: string
  initialDate: string
  initialKind: ReceiptKind
  initialPaidByMemberId: string | null
  members: Member[]
  onUpdate: (id: string, input: { description: string; date: string; kind: ReceiptKind; paidByMemberId: string | null }) => Promise<void>
  onClose: () => void
}

export function EditReceiptModal({ receiptId, initialDescription, initialDate, initialKind, initialPaidByMemberId, members, onUpdate, onClose }: Props) {
  const [description, setDescription] = useState(initialDescription)
  const [date, setDate] = useState(initialDate)
  const [paidByMemberId, setPaidByMemberId] = useState<string | null>(initialKind === 'advance' ? initialPaidByMemberId : null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEscapeKey(onClose)

  async function handleSubmit() {
    if (!description.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await onUpdate(receiptId, { description: description.trim(), date, kind: deriveReceiptKind(paidByMemberId), paidByMemberId })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : MESSAGES.receipt.updateFailed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <h2 className="text-lg font-semibold text-ink mb-5">レシート編集</h2>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1">日付</label>
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
          <label className="block text-sm font-medium text-ink-2 mb-1">店舗名</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="field-input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-2 mb-2">支払い手段</label>
          <div className="flex flex-wrap gap-2">
            <label
              className={`px-4 py-1.5 rounded-full text-sm font-medium border cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-indigo-400 ${
                paidByMemberId === null
                  ? 'bg-indigo-500 border-indigo-500 text-white'
                  : 'border-line-strong text-ink-2 hover:bg-inset'
              }`}
            >
              <input
                type="radio"
                name="editReceiptPaidBy"
                checked={paidByMemberId === null}
                onChange={() => setPaidByMemberId(null)}
                className="sr-only"
              />
              {EXPENSE_KIND_LABEL.card}
            </label>
            {members.map((m) => (
              <label
                key={m.id}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-indigo-400 ${
                  paidByMemberId === m.id
                    ? 'bg-indigo-500 border-indigo-500 text-white'
                    : 'border-line-strong text-ink-2 hover:bg-inset'
                }`}
              >
                <input
                  type="radio"
                  name="editReceiptPaidBy"
                  value={m.id}
                  checked={paidByMemberId === m.id}
                  onChange={() => setPaidByMemberId(m.id)}
                  className="sr-only"
                />
                {m.name}
              </label>
            ))}
          </div>
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
