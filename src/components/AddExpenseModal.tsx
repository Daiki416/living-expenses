import { useState } from 'react'
import type { Category, Member } from '../lib/supabase'
import type { TaxRate } from '../lib/ocr'
import { EXPENSE_KIND_LABEL } from '../config/classifications'
import { MESSAGES } from '../config/messages'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useReceiptScan } from '../hooks/useReceiptScan'
import { ModalShell } from './ModalShell'
import { CategorySelect } from './CategorySelect'
import { ScanItemRow } from './ScanItemRow'

type OnAddGroupParent = {
  date: string
  description: string
  paidByMemberId: string | null
}

type OnAddGroupChild = {
  description: string
  amount: number
  taxRate: TaxRate
  categoryId: string | null
}

type Props = {
  members: Member[]
  categories: Category[]
  defaultDate: string
  rulesMap: ReadonlyMap<string, string>
  onUpsertRule: (keyword: string, categoryId: string) => void
  onDeleteRule: (keyword: string) => void
  onAddGroup: (parent: OnAddGroupParent, children: OnAddGroupChild[]) => Promise<void>
  onClose: () => void
}

export function AddExpenseModal({ members, categories, defaultDate, rulesMap, onUpsertRule, onDeleteRule, onAddGroup, onClose }: Props) {
  const [paidByMemberId, setPaidByMemberId] = useState<string | null>(null)

  useEscapeKey(onClose)

  const {
    scanning, submitting, error, scanResult, scanStoreName,
    scanParentCategoryId, scanChildCategoryId,
    applyCommonCategory, setApplyCommonCategory, commonCategoryId, fileInputRef,
    handleScanReceipt, handleScanStoreNameChange, handleScanDateChange,
    handleScanParentCategoryChange, handleScanChildCategoryChange,
    updateScanItem, setItemCategory, addScanItem, handleAddFromReceipt, selectedScanCount, registeredTotal,
  } = useReceiptScan({
    defaultDate,
    categories,
    rulesMap,
    onUpsertRule,
    onDeleteRule,
    onAddGroup: (parent, children) =>
      onAddGroup({ ...parent, paidByMemberId }, children),
    onClose,
  })

  const addButtonLabel = submitting ? '追加中…' : `${selectedScanCount}件を追加`

  return (
    <ModalShell onClose={onClose} className="max-h-[90dvh] flex flex-col">
      <div className="shrink-0">
        <h2 className="text-lg font-semibold text-ink mb-5">{MESSAGES.addExpense.title}</h2>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleScanReceipt}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={scanning || submitting}
          className="w-full mb-4 flex items-center justify-center gap-2 bg-indigo-50 border-2 border-dashed border-indigo-300 text-indigo-600 dark:bg-indigo-500/10 dark:border-indigo-400/30 dark:text-indigo-300 rounded-xl py-3.5 text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-500/20 disabled:opacity-50 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
          </svg>
          {scanning ? '読み込み中…' : 'レシートを読み込む'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-3 pb-1">
        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1">日付</label>
          <div className="w-full overflow-hidden rounded-lg">
            <input
              type="date"
              value={scanResult.date}
              onChange={(e) => handleScanDateChange(e.target.value)}
              className="field-input min-w-0 appearance-none"
            />
          </div>
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
                name="paidBy"
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
                  name="paidBy"
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

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-ink-2 cursor-pointer">
            <input
              type="checkbox"
              checked={applyCommonCategory}
              onChange={(e) => setApplyCommonCategory(e.target.checked)}
              className="accent-indigo-500"
            />
            全明細に共通のカテゴリーを適用
          </label>
          {applyCommonCategory && (
            <div className="mt-2">
              <CategorySelect
                categories={categories}
                parentCategoryId={scanParentCategoryId}
                childCategoryId={scanChildCategoryId}
                onParentChange={handleScanParentCategoryChange}
                onChildChange={handleScanChildCategoryChange}
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1">店舗名</label>
          <input
            type="text"
            value={scanStoreName}
            onChange={(e) => handleScanStoreNameChange(e.target.value)}
            placeholder="例：スーパー"
            className="field-input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1">明細</label>
          <div className="space-y-2.5">
            {scanResult.items.map((item, i) => (
              <ScanItemRow key={i} item={item} index={i} categories={categories} onUpdate={updateScanItem} onSetCategory={setItemCategory} categoryLocked={applyCommonCategory} lockedCategoryId={commonCategoryId} />
            ))}
          </div>
          <button
            type="button"
            onClick={addScanItem}
            className="w-full mt-2 border border-dashed border-line-strong text-ink-3 rounded-lg py-1.5 text-sm hover:bg-inset transition-colors"
          >
            ＋ 明細を追加
          </button>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>

      {registeredTotal > 0 && (
        <div className="shrink-0 flex items-center justify-between px-1 pb-2 pt-1">
          <span className="text-xs text-ink-3">登録合計</span>
          <span className="text-sm font-semibold text-ink tabular-nums">¥{registeredTotal.toLocaleString()}</span>
        </div>
      )}

      <div className="shrink-0 flex gap-3 pt-3 border-t border-line">
        <button
          type="button"
          onClick={onClose}
          className="btn-secondary flex-1 py-2"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={handleAddFromReceipt}
          disabled={submitting}
          className="btn-primary flex-1 py-2"
        >
          {addButtonLabel}
        </button>
      </div>
    </ModalShell>
  )
}
