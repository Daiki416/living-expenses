import type { Category } from '../lib/supabase'

type Props = {
  categories: Category[]
  parentCategoryId: string
  childCategoryId: string
  onParentChange: (parentId: string, firstChildId: string) => void
  onChildChange: (childId: string) => void
}

export function CategorySelect({ categories, parentCategoryId, childCategoryId, onParentChange, onChildChange }: Props) {
  const parentCategories = categories.filter(c => c.parent_id === null)
  const childCategories = categories.filter(c => c.parent_id === parentCategoryId)

  function handleParentChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newParentId = e.target.value
    const children = categories.filter(c => c.parent_id === newParentId)
    onParentChange(newParentId, children[0]?.id ?? '')
  }

  return (
    <>
      <select
        value={parentCategoryId}
        onChange={handleParentChange}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
      >
        <option value="">未分類</option>
        {parentCategories.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      {childCategories.length > 0 && (
        <select
          value={childCategoryId}
          onChange={(e) => onChildChange(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white mt-2"
        >
          {childCategories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}
    </>
  )
}
