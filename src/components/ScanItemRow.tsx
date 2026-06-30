import { memo } from 'react'
import { toTaxRate } from '../lib/ocr'
import type { ScanItem } from '../lib/ocr'

type Props = {
  item: ScanItem
  index: number
  onUpdate: (index: number, patch: Partial<ScanItem>) => void
}

export const ScanItemRow = memo(function ScanItemRow({ item, index, onUpdate }: Props) {
  const amountInvalid = item.selected && (item.amount === null || item.amount <= 0)

  return (
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
  )
})
