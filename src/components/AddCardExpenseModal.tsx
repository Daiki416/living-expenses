import type { Category } from '../lib/supabase'
import type { TaxRate } from '../lib/ocr'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useReceiptScan } from '../hooks/useReceiptScan'
import { ModalShell } from './ModalShell'
import { CategorySelect } from './CategorySelect'
import { ScanItemRow } from './ScanItemRow'

type OnAddGroupParent = {
  date: string
  description: string
}

type OnAddGroupChild = {
  description: string
  amount: number
  taxRate: TaxRate
  categoryId: string | null
}

type Props = {
  categories: Category[]
  defaultDate: string
  rulesMap: ReadonlyMap<string, string>
  onUpsertRule: (keyword: string, categoryId: string) => void
  onDeleteRule: (keyword: string) => void
  onAddGroup: (parent: OnAddGroupParent, children: OnAddGroupChild[]) => Promise<void>
  onClose: () => void
}

export function AddCardExpenseModal({ categories, defaultDate, rulesMap, onUpsertRule, onDeleteRule, onAddGroup, onClose }: Props) {
  useEscapeKey(onClose)

  const {
    scanning, submitting, error, scanResult, scanStoreName,
    scanParentCategoryId, scanChildCategoryId, fileInputRef,
    handleScanReceipt, handleScanStoreNameChange, handleScanDateChange,
    handleScanParentCategoryChange, handleScanChildCategoryChange,
    updateScanItem, setItemCategory, addScanItem, applyCategoryToAll, handleAddFromReceipt, validScanCount,
  } = useReceiptScan({
    defaultDate,
    categories,
    rulesMap,
    onUpsertRule,
    onDeleteRule,
    onAddGroup,
    onClose,
  })

  const addButtonLabel = submitting ? '追加中…' : `${validScanCount}件を追加`

  return (
    <ModalShell onClose={onClose} className="max-h-[90dvh] flex flex-col">
      <div className="shrink-0">
        <h2 className="text-lg font-semibold text-gray-800 mb-5">クレカ明細追加</h2>

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
          className="w-full mb-4 border border-dashed border-indigo-300 text-indigo-500 rounded-lg py-2 text-sm font-medium hover:bg-indigo-50 disabled:opacity-50 transition"
        >
          {scanning ? '読み込み中…' : 'レシートを読み込む'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-3 pb-1">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">日付</label>
          <div className="w-full overflow-hidden rounded-lg">
            <input
              type="date"
              value={scanResult.date}
              onChange={(e) => handleScanDateChange(e.target.value)}
              className="w-full min-w-0 appearance-none border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">カテゴリー（全明細に適用）</label>
          <CategorySelect
            categories={categories}
            parentCategoryId={scanParentCategoryId}
            childCategoryId={scanChildCategoryId}
            onParentChange={handleScanParentCategoryChange}
            onChildChange={handleScanChildCategoryChange}
          />
          <button
            type="button"
            onClick={applyCategoryToAll}
            className="w-full mt-2 border border-dashed border-gray-300 text-gray-500 rounded-lg py-1.5 text-sm hover:bg-gray-50 transition"
          >
            全明細に適用
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">店舗名</label>
          <input
            type="text"
            value={scanStoreName}
            onChange={(e) => handleScanStoreNameChange(e.target.value)}
            placeholder="例：スーパー"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">明細</label>
          <div className="space-y-2">
            {scanResult.items.map((item, i) => (
              <ScanItemRow key={i} item={item} index={i} categories={categories} onUpdate={updateScanItem} onSetCategory={setItemCategory} />
            ))}
          </div>
          <button
            type="button"
            onClick={addScanItem}
            className="w-full mt-2 border border-dashed border-gray-300 text-gray-500 rounded-lg py-1.5 text-sm hover:bg-gray-50 transition"
          >
            ＋ 明細を追加
          </button>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>

      <div className="shrink-0 flex gap-3 pt-3 border-t border-gray-100">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={handleAddFromReceipt}
          disabled={submitting}
          className="flex-1 bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-60 transition"
        >
          {addButtonLabel}
        </button>
      </div>
    </ModalShell>
  )
}
