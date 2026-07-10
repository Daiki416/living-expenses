import { memo, useMemo, useState } from 'react'
import { toTaxRate, applyTax } from '../lib/ocr'
import type { ScanItem } from '../lib/ocr'
import { TAX_RATE_OPTIONS } from '../config/classifications'
import type { Category } from '../lib/supabase'
import { resolveCategoryColor } from '../lib/categoryColors'
import { CategorySelect } from './CategorySelect'

type Props = {
  item: ScanItem
  index: number
  categories: Category[]
  onUpdate: (index: number, patch: Partial<ScanItem>) => void
  onSetCategory: (index: number, categoryId: string | null) => void
}

// categoryId から表示ラベル（子名、無ければ親名）を算出する。未分類は null を返す。
function resolveCategoryLabel(categoryId: string | null, categories: Category[]): string | null {
  if (!categoryId) return null
  const category = categories.find(c => c.id === categoryId)
  if (!category) return null
  return category.name
}

export const ScanItemRow = memo(function ScanItemRow({ item, index, categories, onUpdate, onSetCategory }: Props) {
  const amountInvalid = item.selected && item.amount !== null && item.amount <= 0
  const [pickerOpen, setPickerOpen] = useState(false)

  // categoryId から CategorySelect 用の parent/child 選択状態を導出する。
  const { parentCategoryId, childCategoryId } = useMemo(() => {
    if (!item.categoryId) return { parentCategoryId: '', childCategoryId: '' }
    const category = categories.find(c => c.id === item.categoryId)
    if (!category) return { parentCategoryId: '', childCategoryId: '' }
    if (category.parent_id === null) return { parentCategoryId: category.id, childCategoryId: '' }
    return { parentCategoryId: category.parent_id, childCategoryId: category.id }
  }, [item.categoryId, categories])

  const categoryLabel = useMemo(
    () => resolveCategoryLabel(item.categoryId, categories),
    [item.categoryId, categories]
  )

  const categoryColor = useMemo(
    () => resolveCategoryColor(item.categoryId, categories),
    [item.categoryId, categories]
  )

  function handleParentChange(parentId: string, firstChildId: string) {
    onSetCategory(index, firstChildId || parentId || null)
  }

  function handleChildChange(childId: string) {
    onSetCategory(index, childId || parentCategoryId || null)
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
            className={`[field-sizing:content] min-w-[2.5rem] max-w-[7rem] bg-transparent text-right text-base font-bold tabular-nums px-0.5 py-1 border-b focus:outline-none placeholder:font-normal placeholder:text-sm placeholder:text-ink-4 ${
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
          onClick={() => setPickerOpen(o => !o)}
          disabled={!item.selected}
          className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs disabled:opacity-60 ${
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

      {pickerOpen && (
        <div className={`pl-6 ${item.selected ? '' : 'opacity-50'}`}>
          <div className="space-y-2">
            <CategorySelect
              categories={categories}
              parentCategoryId={parentCategoryId}
              childCategoryId={childCategoryId}
              onParentChange={handleParentChange}
              onChildChange={handleChildChange}
            />
          </div>
        </div>
      )}
    </div>
  )
})
