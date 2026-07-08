import { useEffect, useMemo, useRef } from 'react'
import type { Category } from '../lib/supabase'

type Props = {
  categories: Category[]
  parentCategoryId: string
  childCategoryId: string
  onParentChange: (parentId: string, firstChildId: string) => void
  onChildChange: (childId: string) => void
}

export function CategorySelect({ categories, parentCategoryId, childCategoryId, onParentChange, onChildChange }: Props) {
  const parentCategories = useMemo(
    () => categories.filter(c => c.parent_id === null),
    [categories]
  )
  const childCategories = useMemo(
    () => categories.filter(c => c.parent_id === parentCategoryId),
    [categories, parentCategoryId]
  )

  // 親カテゴリーが変わったとき、childCategoryId が新しい子リストにない場合のみ最初の子を自動選択する。
  // prevParentId で変化を検知することで、初期マウント時（EditExpenseModal で親カテゴリーIDで
  // 保存済みのケース）をスキップし既存データを上書きしない。
  // childCategoryId が引き続き新しい親の子リストに存在する場合はそのまま維持する。
  // onChildChange は安定した参照でない場合があるため依存配列から除外する。
  const prevParentId = useRef(parentCategoryId)
  useEffect(() => {
    if (prevParentId.current === parentCategoryId) return
    prevParentId.current = parentCategoryId
    if (childCategories.length > 0 && !childCategories.some(c => c.id === childCategoryId)) {
      onChildChange(childCategories[0].id)
    }
  }, [parentCategoryId, childCategories, childCategoryId]) // eslint-disable-line react-hooks/exhaustive-deps

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
        className="field-input"
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
          className="field-input mt-2"
        >
          {childCategories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}
    </>
  )
}
