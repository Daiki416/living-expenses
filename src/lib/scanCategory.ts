// 保存時に明細へ適用する categoryId を決める。
// 共通モードON時は共通カテゴリーで上書きし、OFF時は明細の個別値を使う。
export function resolveScanItemCategoryId(
  applyCommonCategory: boolean,
  commonCategoryId: string | null,
  itemCategoryId: string | null,
): string | null {
  return applyCommonCategory ? commonCategoryId : itemCategoryId
}
