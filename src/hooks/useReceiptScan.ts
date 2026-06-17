import { useRef, useState, useMemo, useCallback } from 'react'
import { extractReceiptData, isValidScanItem, applyTax, DEFAULT_SCAN_TAX_RATE, type ScanItem, type ScanResult } from '../lib/ocr'
import { sanitizeDate } from '../lib/validation'

type UseReceiptScanOptions = {
  defaultDate: string
  onAdd: (params: { date: string; description: string; amount: number; categoryId: string | null }) => Promise<void>
  onClose: () => void
}

export function useReceiptScan({ defaultDate, onAdd, onClose }: UseReceiptScanOptions) {
  const [scanning, setScanning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
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
      const results = await Promise.allSettled(
        validItems.map((item) =>
          onAdd({
            date: scanResult.date,
            description: item.description.trim(),
            amount: applyTax(item.amount, item.taxRate),
            categoryId,
          })
        )
      )
      const failedCount = results.filter((r) => r.status === 'rejected').length
      if (failedCount > 0) {
        setError(`${failedCount}件の追加に失敗しました`)
      } else {
        onClose()
      }
    } finally {
      setSubmitting(false)
    }
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
    setError(null)
  }

  const validScanCount = validItems.length

  return {
    scanning,
    submitting,
    error,
    scanResult,
    scanParentCategoryId,
    scanChildCategoryId,
    fileInputRef,
    handleScanReceipt,
    handleScanDateChange,
    handleScanParentCategoryChange,
    handleScanChildCategoryChange,
    updateScanItem,
    handleAddFromReceipt,
    resetScan,
    validScanCount,
  }
}
