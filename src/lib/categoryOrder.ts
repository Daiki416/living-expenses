/**
 * 並べ替え後の id 配列を、index 通りの sort_order 更新リストに変換する。
 * 差分ではなく常に全件を割り当てることで、stale な現在値との比較による
 * 更新漏れ（sort_order の重複）を防ぐ。
 */
export function computeSortOrderUpdates(
  orderedIds: string[],
): { id: string; sort_order: number }[] {
  return orderedIds.map((id, index) => ({ id, sort_order: index }))
}
