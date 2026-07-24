import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { extractReceiptData, isValidScanItem, hasValidAmount, DEFAULT_SCAN_TAX_RATE, type ScanItem, type ScanResult, type TaxRate } from '../lib/ocr'
import { reconcileReceipt } from '../lib/receiptTotal'
import type { Category } from '../lib/supabase'
import { sanitizeDate } from '../lib/validation'
import { applyRulesToItems } from '../lib/categoryRules'
import { resolveScanItemCategoryId } from '../lib/scanCategory'
import { leafCategoryIds } from '../lib/categoryTree'
import { MESSAGES } from '../config/messages'
import { SETTINGS } from '../config/settings'

type OnAddGroupParent = {
  date: string
  description: string
}

type OnAddGroupChild = {
  description: string
  amount: number
  taxRate: TaxRate
  categoryId: string | null
}

type UseReceiptScanOptions = {
  defaultDate: string
  categories: Category[]
  rulesMap: ReadonlyMap<string, string>
  onUpsertRule: (keyword: string, categoryId: string) => void
  onDeleteRule: (keyword: string) => void
  onAddGroup: (parent: OnAddGroupParent, children: OnAddGroupChild[]) => Promise<void>
  onClose: () => void
  initialFiles?: File[]
}

type PendingReceipt = { date: string; storeName: string; items: ScanItem[]; total: number | null }

const EMPTY_SCAN_ITEM: ScanItem = { description: '', amount: null, selected: true, taxRate: DEFAULT_SCAN_TAX_RATE, categoryId: null, categoryTouched: false }

export function useReceiptScan({ defaultDate, categories, rulesMap, onUpsertRule, onDeleteRule, onAddGroup, onClose, initialFiles }: UseReceiptScanOptions) {
  const [scanning, setScanning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<ScanResult>({ date: defaultDate, items: [{ ...EMPTY_SCAN_ITEM }] })
  const [scanStoreName, setScanStoreName] = useState('')
  const [commonCategoryId, setCommonCategoryId] = useState<string | null>(null)
  const [applyCommonCategory, setApplyCommonCategory] = useState(false)
  const [pendingReceipts, setPendingReceipts] = useState<PendingReceipt[]>([])
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number } | null>(null)
  const [batchTotal, setBatchTotal] = useState(0)
  const [scanTotal, setScanTotal] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scanningRef = useRef(false)

  // 訂正メモリの上書きは有効な葉IDのみに限定する（削除済み・親どまりルールを弾く）。
  const validLeafCategoryIds = useMemo(() => leafCategoryIds(categories), [categories])

  // 一括スキャン：複数枚をまとめてOCRし、先頭を確認画面へ・残りをキューへ積む。
  async function scanFiles(files: File[]) {
    if (files.length === 0) return
    if (files.length > SETTINGS.maxScanFiles) { setError(MESSAGES.scan.tooManyFiles(SETTINGS.maxScanFiles)); return }
    if (scanningRef.current) return
    scanningRef.current = true
    setScanning(true)
    setError(null)
    setScanProgress({ done: 0, total: files.length })
    try {
      // インデックスで順序を保持したまま並列にOCRする（到着順に依存しない）。
      const settled = await Promise.allSettled(
        files.map(async file => {
          try {
            return await extractReceiptData(file, categories)
          } finally {
            setScanProgress(prev => (prev ? { ...prev, done: prev.done + 1 } : prev))
          }
        })
      )
      const receipts: PendingReceipt[] = []
      let firstFailure: string | null = null
      for (const r of settled) {
        if (r.status === 'fulfilled') {
          const data = r.value
          const items = data.items.map(item => ({ ...item, selected: true, taxRate: item.taxRate, categoryId: item.categoryId, categoryTouched: false }))
          receipts.push({
            date: sanitizeDate(data.date, defaultDate),
            storeName: data.storeName ?? '',
            // 訂正メモリを Haiku 判定より優先して確定オーバーライドする（有効な葉IDのみ）。
            items: applyRulesToItems(items, rulesMap, validLeafCategoryIds),
            total: data.total,
          })
        } else if (firstFailure === null) {
          firstFailure = (r.reason as Error)?.message ?? MESSAGES.common.genericError
        }
      }
      const failedCount = files.length - receipts.length
      if (receipts.length === 0) {
        // 全滅：現在の確認画面・キュー・batchTotal を壊さず、最初の失敗理由のみ表示する。
        setError(firstFailure ?? MESSAGES.common.genericError)
        return
      }
      const [first, ...rest] = receipts
      setScanResult({ date: first.date, items: first.items })
      setScanStoreName(first.storeName)
      setScanTotal(first.total)
      setPendingReceipts(rest)
      setBatchTotal(receipts.length)
      setError(failedCount > 0 ? MESSAGES.scan.partialFailure(files.length, failedCount) : null)
    } finally {
      setScanning(false)
      setScanProgress(null)
      scanningRef.current = false
    }
  }

  function handleScanInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length) scanFiles(files)
  }

  // ヘッダのカメラ起動から渡された初期ファイルを1度だけ処理する（StrictModeの二重実行を防ぐ）。
  const didInitRef = useRef(false)
  useEffect(() => {
    if (didInitRef.current) return
    didInitRef.current = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialFiles && initialFiles.length) scanFiles(initialFiles)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateScanItem = useCallback((index: number, patch: Partial<ScanItem>) => {
    setScanResult(prev => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }))
  }, [])

  // 品目のカテゴリーをユーザーが個別に手で選んだことを記録する（学習は登録確定時にまとめて行う）。
  const setItemCategory = useCallback((index: number, categoryId: string | null) => {
    updateScanItem(index, { categoryId, categoryTouched: true })
  }, [updateScanItem])

  function addScanItem() {
    setScanResult(prev => ({ ...prev, items: [...prev.items, { ...EMPTY_SCAN_ITEM }] }))
  }

  const validItems = useMemo(
    () => scanResult.items.filter(isValidScanItem),
    [scanResult]
  )

  // 選択外だが有効な明細（品名あり・金額有効）が存在するか。存在時は合計突合を諦める。
  const hasExcluded = useMemo(
    () => scanResult.items.some(i => !i.selected && i.description.trim() !== '' && hasValidAmount(i.amount)),
    [scanResult]
  )

  // レシート合計へ寄せた税込整数を確定する（validItems と reconcile.amounts は同順）。
  const reconcile = useMemo(
    () => reconcileReceipt(validItems.map(i => ({ amount: i.amount!, taxRate: i.taxRate })), scanTotal, hasExcluded),
    [validItems, scanTotal, hasExcluded]
  )

  const registeredTotal = useMemo(
    () => reconcile.amounts.reduce((sum, a) => sum + a, 0),
    [reconcile]
  )

  // 各明細行の実保存税込（scanResult.items と同順）。無効/保存対象外の行は null（従来プレビューにフォールバック）。
  const reconciledByIndex = useMemo(() => {
    const out = new Array<number | null>(scanResult.items.length).fill(null)
    let vi = 0
    scanResult.items.forEach((it, i) => {
      if (isValidScanItem(it)) { out[i] = reconcile.amounts[vi]; vi++ }
    })
    return out
  }, [scanResult, reconcile])

  // キューの何枚目を確認中か（1始まり）。
  const batchIndex = useMemo(() => batchTotal - pendingReceipts.length, [batchTotal, pendingReceipts.length])

  // キューの次の1枚を確認画面へ載せ替える。残りがなければモーダルを閉じる。
  function advanceOrClose() {
    if (pendingReceipts.length > 0) {
      const [next, ...rest] = pendingReceipts
      setScanResult({ date: next.date, items: next.items })
      setScanStoreName(next.storeName)
      setScanTotal(next.total)
      setPendingReceipts(rest)
      setError(null)
    } else {
      onClose()
    }
  }

  async function handleAddFromReceipt() {
    if (submitting) return
    const checkedItems = scanResult.items.filter(item => item.selected)
    if (checkedItems.length === 0) { setError(MESSAGES.scan.noItemsSelected); return }
    if (checkedItems.some(item => item.description.trim() === '')) { setError(MESSAGES.scan.missingItemName); return }
    if (checkedItems.some(item => !hasValidAmount(item.amount))) { setError(MESSAGES.form.invalidAmount); return }
    // レシート合計に寄せられなかった場合のみ、そのまま登録するか確認する。
    if (reconcile.status === 'mismatch') {
      const ok = window.confirm(MESSAGES.scan.totalMismatch(Math.abs(reconcile.diff ?? 0)))
      if (!ok) return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onAddGroup(
        { date: scanResult.date, description: scanStoreName || 'レシート' },
        validItems.map((item, i) => ({ description: item.description, amount: reconcile.amounts[i], taxRate: item.taxRate, categoryId: resolveScanItemCategoryId(applyCommonCategory, commonCategoryId, item.categoryId) }))
      )
      // 一括適用（共通モード）は学習しない。OFF時のみ、ユーザーが個別に手で選んだ明細を訂正メモリへ学習する（fire-and-forget）。
      if (!applyCommonCategory) {
        for (const item of validItems) {
          if (!item.categoryTouched) continue
          if (item.categoryId) onUpsertRule(item.description, item.categoryId)
          else onDeleteRule(item.description)
        }
      }
      advanceOrClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  // 登録せず現在の1枚を破棄し、キューの次へ進む（一括スキャン時のみ表示）。
  function handleSkip() {
    setError(null)
    advanceOrClose()
  }

  function handleScanStoreNameChange(v: string) {
    setScanStoreName(v)
  }

  function handleScanDateChange(date: string) {
    setScanResult(prev => ({ ...prev, date }))
  }

  function resetScan() {
    setScanResult({ date: defaultDate, items: [{ ...EMPTY_SCAN_ITEM }] })
    setScanStoreName('')
    setScanTotal(null)
    setError(null)
  }

  const selectedScanCount = useMemo(() => scanResult.items.filter(item => item.selected).length, [scanResult])

  return {
    scanning,
    submitting,
    error,
    scanResult,
    scanStoreName,
    applyCommonCategory,
    setApplyCommonCategory,
    commonCategoryId,
    setCommonCategoryId,
    fileInputRef,
    pendingReceipts,
    batchTotal,
    batchIndex,
    scanProgress,
    handleScanInputChange,
    handleScanStoreNameChange,
    handleScanDateChange,
    updateScanItem,
    setItemCategory,
    addScanItem,
    handleAddFromReceipt,
    handleSkip,
    resetScan,
    selectedScanCount,
    registeredTotal,
    reconcile,
    reconciledByIndex,
  }
}
