// 共通カテゴリー選択（親/子）から子優先で有効な categoryId を解決する。
export function resolveCommonCategoryId(parentCategoryId: string, childCategoryId: string): string | null {
  return childCategoryId || parentCategoryId || null
}

// 保存時に明細へ適用する categoryId を決める。
// 共通モードON時は共通カテゴリーで上書きし、OFF時は明細の個別値を使う。
export function resolveScanItemCategoryId(
  applyCommonCategory: boolean,
  commonCategoryId: string | null,
  itemCategoryId: string | null,
): string | null {
  return applyCommonCategory ? commonCategoryId : itemCategoryId
}
