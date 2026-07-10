import { describe, it, expect } from 'vitest'
import { MESSAGES } from './messages'

describe('MESSAGES', () => {
  it('主要文言が非空文字列である', () => {
    expect(MESSAGES.form.invalidAmount.length).toBeGreaterThan(0)
    expect(MESSAGES.auth.passwordMismatch.length).toBeGreaterThan(0)
    expect(MESSAGES.scan.noItemsSelected.length).toBeGreaterThan(0)
    expect(MESSAGES.scan.missingItemName.length).toBeGreaterThan(0)
    expect(MESSAGES.receipt.updateFailed.length).toBeGreaterThan(0)
    expect(MESSAGES.common.duplicateName.length).toBeGreaterThan(0)
    expect(MESSAGES.common.genericError.length).toBeGreaterThan(0)
    expect(MESSAGES.config.missingSupabaseEnv.length).toBeGreaterThan(0)
    expect(MESSAGES.ocr.edgeCallFailed.length).toBeGreaterThan(0)
    expect(MESSAGES.ocr.edgeBadResponse.length).toBeGreaterThan(0)
  })

  it('scan.missingItemName は「品目名を入力してください」である', () => {
    expect(MESSAGES.scan.missingItemName).toBe('品目名を入力してください')
  })

  it('unsupportedImageType は与えた型を含む', () => {
    expect(MESSAGES.ocr.unsupportedImageType('image/x')).toContain('image/x')
  })

  it('fileTooLarge(5) は 5MB を含み既存文言と一致する', () => {
    expect(MESSAGES.ocr.fileTooLarge(5)).toContain('5MB')
    expect(MESSAGES.ocr.fileTooLarge(5)).toBe('画像ファイルは5MB以下にしてください')
  })
})
