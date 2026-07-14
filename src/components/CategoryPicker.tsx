import type { Category } from '../lib/supabase'
import { resolveCategoryColor } from '../lib/categoryColors'
import { isLeafCategory } from '../lib/categoryTree'
import { ModalShell } from './ModalShell'

type Props = {
  categories: Category[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onClose: () => void
}

// カテゴリーをタップで選ぶ共通ピッカー。確定できるのは「葉（子を持たない）」または未分類(null)のみ。
// 子を持つ親は見出し行として表示し、タップしても確定・クローズしない。
// childless親（旧データ・子を持たない親）は葉扱いで確定可（isLeafCategory で判定）。
export function CategoryPicker({ categories, selectedId, onSelect, onClose }: Props) {
  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink-2">カテゴリーを選択</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-ink-4 text-lg leading-none px-1"
          aria-label="閉じる"
        >
          ×
        </button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${
            selectedId ? 'text-ink-2' : 'bg-inset font-medium text-ink'
          }`}
        >
          <span className="cat-dot w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: '#d1d5db' }} />
          未分類
        </button>
        {categories.filter(c => c.parent_id === null).map(parent => {
          const parentIsLeaf = isLeafCategory(parent.id, categories)
          return (
            <div key={parent.id}>
              {parentIsLeaf ? (
                <button
                  type="button"
                  onClick={() => onSelect(parent.id)}
                  className={`w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${
                    selectedId === parent.id ? 'bg-inset font-medium text-ink' : 'text-ink-2'
                  }`}
                >
                  <span className="cat-dot w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: resolveCategoryColor(parent.id, categories) ?? '#d1d5db' }} />
                  {parent.name}
                </button>
              ) : (
                <div className="w-full flex items-center gap-2 px-2 pt-2 pb-1 text-left text-xs font-semibold text-ink-3">
                  <span className="cat-dot w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: resolveCategoryColor(parent.id, categories) ?? '#d1d5db' }} />
                  {parent.name}
                </div>
              )}
              {categories.filter(c => c.parent_id === parent.id).map(child => (
                isLeafCategory(child.id, categories) ? (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => onSelect(child.id)}
                    className={`w-full flex items-center gap-2 rounded-lg pl-7 pr-2 py-2 text-left text-sm ${
                      selectedId === child.id ? 'bg-inset font-medium text-ink' : 'text-ink-3'
                    }`}
                  >
                    <span className="cat-dot w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: resolveCategoryColor(child.id, categories) ?? '#d1d5db' }} />
                    {child.name}
                  </button>
                ) : (
                  // 孫階層など壊れデータで非葉の子が来た場合は親と対称に見出し扱い（確定不可）。
                  <div key={child.id} className="w-full flex items-center gap-2 pl-7 pr-2 pt-2 pb-1 text-left text-xs font-semibold text-ink-3">
                    <span className="cat-dot w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: resolveCategoryColor(child.id, categories) ?? '#d1d5db' }} />
                    {child.name}
                  </div>
                )
              ))}
            </div>
          )
        })}
      </div>
    </ModalShell>
  )
}
