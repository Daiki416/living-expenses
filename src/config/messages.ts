export const MESSAGES = {
  form: {
    invalidAmount: '金額は1以上の整数で入力してください',
    invalidDate: '日付を入力してください',
    invalidDescription: '内容を入力してください',
    invalidPaidBy: '支払者を選択してください',
  },
  auth: {
    passwordMismatch: 'パスワードが一致しません',
  },
  ocr: {
    unsupportedImageType: (rawType: string) => `サポートされていない画像形式です: ${rawType}`,
    edgeCallFailed: 'OCR Edge Function の呼び出しに失敗しました',
    edgeBadResponse: 'OCR Edge Function のレスポンスが不正です',
    fileTooLarge: (mb: number) => `画像ファイルは${mb}MB以下にしてください`,
  },
  scan: {
    noItemsSelected: '追加する項目を選択してください',
    missingItemName: '品目名を入力してください',
    partialFailure: (total: number, failed: number) => `${total}枚中${failed}枚は読み取れませんでした（残りは反映済み）`,
    tooManyFiles: (max: number) => `一度に読み込めるのは${max}枚までです`,
  },
  list: {
    empty: 'この月の支出はありません',
    noMatch: '条件に一致する明細がありません',
    clearFilter: 'フィルター解除',
  },
  addExpense: {
    title: '支出を追加',
  },
  receipt: {
    updateFailed: '更新に失敗しました',
    deleteConfirm: (name: string, count: number) =>
      `「${name || 'このレシート'}」を削除しますか？\nこの${count}件の明細も削除されます。`,
  },
  common: {
    duplicateName: '同じ名前がすでに存在します',
    genericError: 'エラーが発生しました。もう一度お試しください',
  },
  config: {
    missingSupabaseEnv: 'VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を .env に設定してください',
  },
} as const
