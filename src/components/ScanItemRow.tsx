import { memo, useMemo, useState } from 'react'
import { toTaxRate, applyTax } from '../lib/ocr'
import type { ScanItem } from '../lib/ocr'
import { TAX_RATE_OPTIONS } from '../config/classifications'
import type { Category } from '../lib/supabase'
import { resolveCategoryColor } from '../lib/categoryColors'
import { ModalShell } from './ModalShell'

type Props = {
  item: ScanItem
  index: number
  categories: Category[]
  onUpdate: (index: number, patch: Partial<ScanItem>) => void
  onSetCategory: (index: number, categoryId: string | null) => void
  categoryLocked?: boolean
  lockedCategoryId?: string | null
}

// categoryId から表示ラベル（子名、無ければ親名）を算出する。未分類は null を返す。
function resolveCategoryLabel(categoryId: string | null, categories: Category[]): string | null {
  if (!categoryId) return null
  const category = categories.find(c => c.id === categoryId)
  if (!category) return null
  return category.name
}

export const ScanItemRow = memo(function ScanItemRow({ item, index, categories, onUpdate, onSetCategory, categoryLocked = false, lockedCategoryId = null }: Props) {
  const amountInvalid = item.selected && item.amount !== null && item.amount <= 0
  const [pickerOpen, setPickerOpen] = useState(false)

  // 共通モード時は共通カテゴリー値を表示・使用し、個別モードでは明細の個別値を使う。
  const displayCategoryId = categoryLocked ? lockedCategoryId : item.categoryId
  // カテゴリー操作をロックするか（disabled かつピッカー非表示）。
  const categoryDisabled = !item.selected || categoryLocked

  const categoryLabel = useMemo(
    () => resolveCategoryLabel(displayCategoryId, categories),
    [displayCategoryId, categories]
  )

  const categoryColor = useMemo(
    () => resolveCategoryColor(displayCategoryId, categories),
    [displayCategoryId, categories]
  )

  function selectCategory(categoryId: string | null) {
    onSetCategory(index, categoryId)
    setPickerOpen(false)
  }

  const showTaxedAmount =
    item.selected && item.amount !== null && Number.isInteger(item.amount) && item.amount > 0

  return (
    <div className={`rounded-xl border p-2.5 flex flex-col gap-1.5 transition-colors ${
      item.selected ? 'border-line bg-surface' : 'border-line bg-inset'
    }`}>
      <div className={`flex items-baseline gap-2 ${item.selected ? '' : 'opacity-50'}`}>
        <input
          type="checkbox"
          checked={item.selected}
          onChange={(e) => onUpdate(index, { selected: e.target.checked })}
          className="accent-indigo-500 shrink-0 self-center"
        />
        <input
          type="text"
          value={item.description}
          onChange={(e) => onUpdate(index, { description: e.target.value })}
          placeholder="品目名"
          disabled={!item.selected}
          className="flex-1 min-w-0 bg-transparent px-1 py-1 text-sm text-ink border-b border-transparent focus:outline-none focus:border-indigo-400 disabled:text-ink-4 placeholder:text-ink-4"
        />
        <div className="shrink-0 flex items-baseline justify-end gap-0.5">
          <span className={`text-sm ${amountInvalid ? 'text-red-500' : 'text-ink-4'}`}>¥</span>
          <input
            type="text"
            inputMode="numeric"
            value={item.amount === null ? '' : item.amount.toLocaleString()}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^\d]/g, '')
              const parsed = parseInt(digits, 10)
              onUpdate(index, { amount: digits === '' || isNaN(parsed) ? null : parsed })
            }}
            placeholder="金額"
            disabled={!item.selected}
            className={`[field-sizing:content] min-w-[3.5rem] max-w-[9rem] bg-transparent text-right text-base font-bold tabular-nums px-0.5 py-1 border-b focus:outline-none placeholder:font-normal placeholder:text-sm placeholder:text-ink-4 ${
              amountInvalid
                ? 'text-red-600 border-red-400 focus:border-red-500'
                : 'text-ink border-transparent focus:border-indigo-400'
            }`}
          />
        </div>
      </div>

      <div className={`pl-6 flex items-center gap-2 ${item.selected ? '' : 'opacity-50'}`}>
        <select
          value={item.taxRate}
          onChange={(e) => onUpdate(index, { taxRate: toTaxRate(Number(e.target.value)) })}
          disabled={!item.selected}
          className="appearance-none rounded-full bg-inset text-ink-2 text-xs px-2.5 py-0.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60 shrink-0"
        >
          {TAX_RATE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={categoryDisabled}
          className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs disabled:opacity-60 ${
            categoryLocked ? 'opacity-50' : ''
          } ${
            categoryLabel ? 'text-ink-2' : 'text-ink-4'
          }`}
        >
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: categoryColor ?? '#d1d5db' }} />
          {categoryLabel ?? '未分類'}
        </button>
        {showTaxedAmount && (
          <span className="ml-auto text-xs font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
            → ¥{applyTax(item.amount!, item.taxRate).toLocaleString()}
          </span>
        )}
      </div>

      {pickerOpen && !categoryLocked && (
        <ModalShell onClose={() => setPickerOpen(false)}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-ink-2">カテゴリーを選択</h3>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="text-ink-4 text-lg leading-none px-1"
              aria-label="閉じる"
            >
              ×
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2">
            <button
              type="button"
              onClick={() => selectCategory(null)}
              className={`w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${
                displayCategoryId ? 'text-ink-2' : 'bg-inset font-medium text-ink'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: '#d1d5db' }} />
              未分類
            </button>
            {categories.filter(c => c.parent_id === null).map(parent => (
              <div key={parent.id}>
                <button
                  type="button"
                  onClick={() => selectCategory(parent.id)}
                  className={`w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${
                    displayCategoryId === parent.id ? 'bg-inset font-medium text-ink' : 'text-ink-2'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: resolveCategoryColor(parent.id, categories) ?? '#d1d5db' }} />
                  {parent.name}
                </button>
                {categories.filter(c => c.parent_id === parent.id).map(child => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => selectCategory(child.id)}
                    className={`w-full flex items-center gap-2 rounded-lg pl-7 pr-2 py-2 text-left text-sm ${
                      displayCategoryId === child.id ? 'bg-inset font-medium text-ink' : 'text-ink-3'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: resolveCategoryColor(child.id, categories) ?? '#d1d5db' }} />
                    {child.name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </ModalShell>
      )}
    </div>
  )
})
