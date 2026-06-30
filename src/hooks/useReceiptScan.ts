import { useRef, useState, useMemo, useCallback } from 'react'
import { extractReceiptData, isValidScanItem, DEFAULT_SCAN_TAX_RATE, type ScanItem, type ScanResult } from '../lib/ocr'
import { sanitizeDate } from '../lib/validation'

type OnAddGroupParent = {
  date: string
  description: string
  categoryId: string | null
}

type OnAddGroupChild = {
  description: string
  amount: number
  taxRate: number
}

type UseReceiptScanOptions = {
  defaultDate: string
  onAddGroup: (parent: OnAddGroupParent, children: OnAddGroupChild[]) => Promise<void>
  onClose: () => void
}

const EMPTY_SCAN_ITEM: ScanItem = { description: '', amount: null, selected: true, taxRate: DEFAULT_SCAN_TAX_RATE }

export function useReceiptScan({ defaultDate, onAddGroup, onClose }: UseReceiptScanOptions) {
  const [scanning, setScanning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [scanStoreName, setScanStoreName] = useState('')
  const [scanParentCategoryId, setScanParentCategoryId] = useState('')
  const [scanChildCategoryId, setScanChildCategoryId] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleScanReceipt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setScanning(true)
    setError(null)
    try {
      const data = await extractReceiptData(file)
      setScanStoreName(data.storeName ?? '')
      setScanResult({
        date: sanitizeDate(data.date, defaultDate),
        items: data.items.map(item => ({ ...item, selected: true, taxRate: DEFAULT_SCAN_TAX_RATE })),
      })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setScanning(false)
    }
  }

  const updateScanItem = useCallback((index: number, patch: Partial<ScanItem>) => {
    setScanResult(prev =>
      prev
        ? { ...prev, items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) }
        : null
    )
  }, [])

  function addScanItem() {
    setScanResult(prev =>
      prev ? { ...prev, items: [...prev.items, { ...EMPTY_SCAN_ITEM }] } : null
    )
  }

  function startManualGroup() {
    setScanResult({ date: defaultDate, items: [{ ...EMPTY_SCAN_ITEM }] })
    setScanStoreName('')
    setScanParentCategoryId('')
    setScanChildCategoryId('')
    setError(null)
  }

  const validItems = useMemo(
    () => (scanResult ? scanResult.items.filter(isValidScanItem) : []),
    [scanResult]
  )

  async function handleAddFromReceipt() {
    if (!scanResult || submitting) return
    if (validItems.length === 0) { setError('追加する項目を選択してください'); return }
    setSubmitting(true)
    setError(null)
    const categoryId = scanChildCategoryId || scanParentCategoryId || null
    try {
      await onAddGroup(
        { date: scanResult.date, description: scanStoreName || 'レシート', categoryId },
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        validItems.map(item => ({ description: item.description, amount: item.amount!, taxRate: item.taxRate }))
      )
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
    setScanResult(prev => prev ? { ...prev, date } : null)
  }

  function handleScanParentCategoryChange(parentId: string, firstChildId: string) {
    setScanParentCategoryId(parentId)
    setScanChildCategoryId(firstChildId)
  }

  function handleScanChildCategoryChange(childId: string) {
    setScanChildCategoryId(childId)
  }

  function resetScan() {
    setScanResult(null)
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
    addScanItem,
    startManualGroup,
    handleAddFromReceipt,
    resetScan,
    validScanCount,
  }
}
