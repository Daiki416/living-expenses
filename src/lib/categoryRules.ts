import type { ScanItem } from './ocr'

// 品名を訂正メモリのキーに正規化する（NFKC・trim・空白畳み込み・小文字化）。
export function normalizeKeyword(s: string): string {
  return s.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
}

// 訂正メモリ（keyword→categoryId）を品目に適用し、一致した categoryId を確定オーバーライドする。
// 削除済みカテゴリー等で無効な category_id は無視し、有効なIDのみ上書きする。
// 一致時のみ新オブジェクトを生成し、非一致は同一参照を維持する。
export function applyRulesToItems(
  items: ScanItem[],
  rulesMap: ReadonlyMap<string, string>,
  validCategoryIds: ReadonlySet<string>,
): ScanItem[] {
  return items.map(item => {
    const key = normalizeKeyword(item.description)
    if (!key) return item
    const ruled = rulesMap.get(key)
    return ruled && validCategoryIds.has(ruled) ? { ...item, categoryId: ruled } : item
  })
}
