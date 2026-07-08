import { useRef, useState, useMemo, useCallback } from 'react'
import { extractReceiptData, isValidScanItem, applyTax, DEFAULT_SCAN_TAX_RATE, type ScanItem, type ScanResult, type TaxRate } from '../lib/ocr'
import type { Category } from '../lib/supabase'
import { sanitizeDate } from '../lib/validation'
import { applyRulesToItems } from '../lib/categoryRules'

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
}

const EMPTY_SCAN_ITEM: ScanItem = { description: '', amount: null, selected: true, taxRate: DEFAULT_SCAN_TAX_RATE, categoryId: null, categoryTouched: false }

export function useReceiptScan({ defaultDate, categories, rulesMap, onUpsertRule, onDeleteRule, onAddGroup, onClose }: UseReceiptScanOptions) {
  const [scanning, setScanning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<ScanResult>({ date: defaultDate, items: [{ ...EMPTY_SCAN_ITEM }] })
  const [scanStoreName, setScanStoreName] = useState('')
  const [scanParentCategoryId, setScanParentCategoryId] = useState('')
  const [scanChildCategoryId, setScanChildCategoryId] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 削除済みカテゴリーの stale なルールを弾くための有効カテゴリーID集合。
  const validCategoryIds = useMemo(() => new Set(categories.map(c => c.id)), [categories])

  async function handleScanReceipt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setScanning(true)
    setError(null)
    try {
      const data = await extractReceiptData(file, categories)
      setScanStoreName(data.storeName ?? '')
      const items = data.items.map(item => ({ ...item, selected: true, taxRate: item.taxRate, categoryId: item.categoryId, categoryTouched: false }))
      setScanResult({
        date: sanitizeDate(data.date, defaultDate),
        // 訂正メモリを Haiku 判定より優先して確定オーバーライドする。
        items: applyRulesToItems(items, rulesMap, validCategoryIds),
      })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setScanning(false)
    }
  }

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

  // グループのカテゴリー（子優先）を全明細の categoryId に一括上書きする。一括適用は学習しない。
  const applyCategoryToAll = useCallback(() => {
    const categoryId = scanChildCategoryId || scanParentCategoryId || null
    setScanResult(prev => ({
      ...prev,
      items: prev.items.map(item => ({ ...item, categoryId, categoryTouched: false })),
    }))
  }, [scanChildCategoryId, scanParentCategoryId])

  const validItems = useMemo(
    () => scanResult.items.filter(isValidScanItem),
    [scanResult]
  )

  const registeredTotal = useMemo(
    () => validItems.reduce((sum, item) => sum + applyTax(item.amount!, item.taxRate), 0),
    [validItems]
  )

  async function handleAddFromReceipt() {
    if (submitting) return
    if (validItems.length === 0) { setError('追加する項目を選択してください'); return }
    setSubmitting(true)
    setError(null)
    try {
      await onAddGroup(
        { date: scanResult.date, description: scanStoreName || 'レシート' },
        validItems.map(item => ({ description: item.description, amount: item.amount!, taxRate: item.taxRate, categoryId: item.categoryId }))
      )
      // ユーザーが個別に手で選んだ明細のみ、登録確定後に訂正メモリへ学習する（fire-and-forget）。
      for (const item of validItems) {
        if (!item.categoryTouched) continue
        if (item.categoryId) onUpsertRule(item.description, item.categoryId)
        else onDeleteRule(item.description)
      }
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  function handleScanStoreNameChange(v: string) {
    setScanStoreName(v)
  }

  function handleScanDateChange(date: string) {
    setScanResult(prev => ({ ...prev, date }))
  }

  function handleScanParentCategoryChange(parentId: string, firstChildId: string) {
    setScanParentCategoryId(parentId)
    setScanChildCategoryId(firstChildId)
  }

  function handleScanChildCategoryChange(childId: string) {
    setScanChildCategoryId(childId)
  }

  function resetScan() {
    setScanResult({ date: defaultDate, items: [{ ...EMPTY_SCAN_ITEM }] })
    setScanStoreName('')
    setError(null)
  }

  const validScanCount = validItems.length

  return {
    scanning,
    submitting,
    error,
    scanResult,
    scanStoreName,
    scanParentCategoryId,
    scanChildCategoryId,
    fileInputRef,
    handleScanReceipt,
    handleScanStoreNameChange,
    handleScanDateChange,
    handleScanParentCategoryChange,
    handleScanChildCategoryChange,
    updateScanItem,
    setItemCategory,
    addScanItem,
    applyCategoryToAll,
    handleAddFromReceipt,
    resetScan,
    validScanCount,
    registeredTotal,
  }
}
