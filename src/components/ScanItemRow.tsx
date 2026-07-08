import { memo, useMemo, useState } from 'react'
import { toTaxRate } from '../lib/ocr'
import type { ScanItem } from '../lib/ocr'
import type { Category } from '../lib/supabase'
import { CategorySelect } from './CategorySelect'

type Props = {
  item: ScanItem
  index: number
  categories: Category[]
  onUpdate: (index: number, patch: Partial<ScanItem>) => void
}

// categoryId から表示ラベル（親のみ or `親 > 子`）を算出する。未分類は null を返す。
function resolveCategoryLabel(categoryId: string | null, categories: Category[]): string | null {
  if (!categoryId) return null
  const category = categories.find(c => c.id === categoryId)
  if (!category) return null
  if (category.parent_id === null) return category.name
  const parent = categories.find(c => c.id === category.parent_id)
  return parent ? `${parent.name} > ${category.name}` : category.name
}

export const ScanItemRow = memo(function ScanItemRow({ item, index, categories, onUpdate }: Props) {
  const amountInvalid = item.selected && (item.amount === null || item.amount <= 0)
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

  function handleParentChange(parentId: string, firstChildId: string) {
    onUpdate(index, { categoryId: firstChildId || parentId || null })
  }

  function handleChildChange(childId: string) {
    onUpdate(index, { categoryId: childId || parentCategoryId || null })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={item.selected}
          onChange={(e) => onUpdate(index, { selected: e.target.checked })}
          className="accent-indigo-500 shrink-0"
        />
        <input
          type="text"
          value={item.description}
          onChange={(e) => onUpdate(index, { description: e.target.value })}
          className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <input
          type="number"
          value={item.amount ?? ''}
          onChange={(e) => {
            const v = e.target.value
            const parsed = parseInt(v, 10)
            onUpdate(index, { amount: v === '' || isNaN(parsed) ? null : parsed })
          }}
          min={1}
          placeholder="金額"
          className={`w-20 shrink-0 border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 ${
            amountInvalid
              ? 'border-red-400 focus:ring-red-400'
              : 'border-gray-300 focus:ring-indigo-400'
          }`}
        />
        <select
          value={item.taxRate}
          onChange={(e) => onUpdate(index, { taxRate: toTaxRate(Number(e.target.value)) })}
          className="w-20 shrink-0 border border-gray-300 rounded-lg px-1 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value={8}>8%</option>
          <option value={10}>10%</option>
          <option value={0}>税込</option>
        </select>
      </div>

      <div className="pl-6">
        <button
          type="button"
          onClick={() => setPickerOpen(o => !o)}
          className={`inline-flex items-center gap-1 border border-gray-300 rounded-full px-2.5 py-0.5 text-xs hover:bg-gray-50 transition ${
            categoryLabel ? 'text-gray-600' : 'text-gray-400'
          }`}
        >
          {categoryLabel ?? '未分類'}
        </button>
        {pickerOpen && (
          <div className="mt-1.5 space-y-2">
            <CategorySelect
              categories={categories}
              parentCategoryId={parentCategoryId}
              childCategoryId={childCategoryId}
              onParentChange={handleParentChange}
              onChildChange={handleChildChange}
            />
          </div>
        )}
      </div>
    </div>
  )
})
