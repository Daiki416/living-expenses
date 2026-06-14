import { useRef, useState } from 'react'
import type { CardExpense, Category } from '../lib/supabase'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { ModalShell } from './ModalShell'
import { CategorySelect } from './CategorySelect'
import { extractReceiptData } from '../lib/ocr'

type Props = {
  categories: Category[]
  defaultDate: string
  onAdd: (input: Omit<CardExpense, 'id' | 'created_at'>) => Promise<void>
  onClose: () => void
}

type ScanItem = { description: string; amount: number; selected: boolean }
type ScanResult = { date: string; items: ScanItem[] }

export function AddCardExpenseModal({ categories, defaultDate, onAdd, onClose }: Props) {
  const [date, setDate] = useState(defaultDate)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [parentCategoryId, setParentCategoryId] = useState('')
  const [childCategoryId, setChildCategoryId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEscapeKey(onClose)

  async function handleScanReceipt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setScanning(true)
    setError(null)
    try {
      const data = await extractReceiptData(file)
      setScanResult({
        date: data.date ?? date,
        items: data.items.map(item => ({ ...item, selected: true })),
      })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setScanning(false)
    }
  }

  function updateScanItem(index: number, patch: Partial<ScanItem>) {
    setScanResult(prev => prev ? { ...prev, items: prev.items.map((item, i) => i === index ? { ...item, ...patch } : item) } : null)
  }

  async function handleAddFromReceipt() {
    if (!scanResult) return
    const selected = scanResult.items.filter(i => i.selected && i.description.trim() && i.amount > 0)
    if (selected.length === 0) { setError('追加する項目を選択してください'); return }
    setSubmitting(true)
    setError(null)
    try {
      for (const item of selected) {
        await onAdd({ date: scanResult.date, description: item.description.trim(), amount: item.amount, category_id: null })
      }
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsed = Number(amount)
    if (!date) { setError('日付を入力してください'); return }
    if (!description.trim()) { setError('内容を入力してください'); return }
    if (!Number.isInteger(parsed) || parsed <= 0) { setError('金額は1以上の整数で入力してください'); return }
    const effectiveCategoryId = childCategoryId || parentCategoryId || null
    setSubmitting(true)
    setError(null)
    try {
      await onAdd({ date, description: description.trim(), amount: parsed, category_id: effectiveCategoryId })
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <ModalShell onClose={onClose} className="overflow-hidden">
      <h2 className="text-lg font-semibold text-gray-800 mb-5">クレカ明細追加</h2>

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScanReceipt} />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={scanning || submitting}
        className="w-full mb-4 border border-dashed border-indigo-300 text-indigo-500 rounded-lg py-2 text-sm font-medium hover:bg-indigo-50 disabled:opacity-50 transition"
      >
        {scanning ? '読み込み中…' : 'レシートを読み込む'}
      </button>

      {scanResult ? (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">日付</label>
            <div className="w-full overflow-hidden rounded-lg">
              <input
                type="date"
                value={scanResult.date}
                onChange={(e) => setScanResult(prev => prev ? { ...prev, date: e.target.value } : null)}
                className="w-full min-w-0 appearance-none border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">明細</label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {scanResult.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={(e) => updateScanItem(i, { selected: e.target.checked })}
                    className="accent-indigo-500 shrink-0"
                  />
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateScanItem(i, { description: e.target.value })}
                    className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <input
                    type="number"
                    value={item.amount}
                    onChange={(e) => updateScanItem(i, { amount: Number(e.target.value) })}
                    min={1}
                    className="w-24 shrink-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => { setScanResult(null); setError(null) }}
              className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition"
            >
              戻る
            </button>
            <button
              type="button"
              onClick={handleAddFromReceipt}
              disabled={submitting}
              className="flex-1 bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-60 transition"
            >
              {submitting ? '追加中…' : `${scanResult.items.filter(i => i.selected).length}件を追加`}
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
      )}
    </ModalShell>
  )
}
