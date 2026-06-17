import { useState } from 'react'
import type { CardExpense, Category } from '../lib/supabase'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useReceiptScan } from '../hooks/useReceiptScan'
import { ModalShell } from './ModalShell'
import { CategorySelect } from './CategorySelect'
import { ScanItemRow } from './ScanItemRow'
import { parsePositiveInt, FORM_ERROR_MESSAGES } from '../lib/validation'

type Props = {
  categories: Category[]
  defaultDate: string
  onAdd: (input: Omit<CardExpense, 'id' | 'created_at'>) => Promise<void>
  onClose: () => void
}

export function AddCardExpenseModal({ categories, defaultDate, onAdd, onClose }: Props) {
  const [date, setDate] = useState(defaultDate)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [parentCategoryId, setParentCategoryId] = useState('')
  const [childCategoryId, setChildCategoryId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEscapeKey(onClose)

  const scan = useReceiptScan({
    defaultDate,
    onAdd: ({ date, description, amount, categoryId }) =>
      onAdd({ date, description, amount, category_id: categoryId }),
    onClose,
  })

  function validateForm(): { validatedAmount: number } | null {
    if (!date) { setError(FORM_ERROR_MESSAGES.invalidDate); return null }
    if (!description.trim()) { setError(FORM_ERROR_MESSAGES.invalidDescription); return null }
    const result = parsePositiveInt(amount)
    if (!result) { setError(FORM_ERROR_MESSAGES.invalidAmount); return null }
    return result
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const valid = validateForm()
    if (!valid) return
    const effectiveCategoryId = childCategoryId || parentCategoryId || null
    setSubmitting(true)
    setError(null)
    try {
      await onAdd({ date, description: description.trim(), amount: valid.validatedAmount, category_id: effectiveCategoryId })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmitAndContinue() {
    const valid = validateForm()
    if (!valid) return
    const savedDescription = description.trim()
    const savedAmount = valid.validatedAmount
    const effectiveCategoryId = childCategoryId || parentCategoryId || null
    setError(null)
    setSubmitting(true)
    setDescription('')
    setAmount('')
    try {
      await onAdd({ date, description: savedDescription, amount: savedAmount, category_id: effectiveCategoryId })
    } catch (err) {
      setError((err as Error).message)
      setDescription(savedDescription)
      setAmount(String(savedAmount))
    } finally {
      setSubmitting(false)
    }
  }

  const isDisabled = scan.submitting || submitting

  const addButtonLabel = scan.submitting ? '追加中…' : `${scan.validScanCount}件を追加`

  return (
    <ModalShell onClose={onClose} className="overflow-hidden">
      <h2 className="text-lg font-semibold text-gray-800 mb-5">クレカ明細追加</h2>

      <input
        ref={scan.fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={scan.handleScanReceipt}
      />
      <button
        type="button"
        onClick={() => scan.fileInputRef.current?.click()}
        disabled={scan.scanning || isDisabled}
        className="w-full mb-4 border border-dashed border-indigo-300 text-indigo-500 rounded-lg py-2 text-sm font-medium hover:bg-indigo-50 disabled:opacity-50 transition"
      >
        {scan.scanning ? '読み込み中…' : 'レシートを読み込む'}
      </button>

      {scan.scanResult ? (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">日付</label>
            <div className="w-full overflow-hidden rounded-lg">
              <input
                type="date"
                value={scan.scanResult.date}
                onChange={(e) => scan.handleScanDateChange(e.target.value)}
                className="w-full min-w-0 appearance-none border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">カテゴリー</label>
            <CategorySelect
              categories={categories}
              parentCategoryId={scan.scanParentCategoryId}
              childCategoryId={scan.scanChildCategoryId}
              onParentChange={scan.handleScanParentCategoryChange}
              onChildChange={scan.handleScanChildCategoryChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">明細</label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {scan.scanResult.items.map((item, i) => (
                <ScanItemRow key={i} item={item} index={i} onUpdate={scan.updateScanItem} />
              ))}
            </div>
          </div>

          {scan.error && <p className="text-red-500 text-sm">{scan.error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={scan.resetScan}
              className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition"
            >
              戻る
            </button>
            <button
              type="button"
              onClick={scan.handleAddFromReceipt}
              disabled={scan.submitting}
              className="flex-1 bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-60 transition"
            >
              {addButtonLabel}
            </button>
          </div>
        </div>
      ) : (
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

          <div className="flex gap-2 pt-1">
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
              追加
            </button>
            <button
              type="button"
              onClick={handleSubmitAndContinue}
              disabled={submitting}
              className="flex-1 bg-indigo-100 text-indigo-700 rounded-lg py-2 text-sm font-medium hover:bg-indigo-200 disabled:opacity-60 transition"
            >
              続けて追加
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  )
}
