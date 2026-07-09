import { describe, it, expect } from 'vitest'
import { splitDateChip } from './format'

describe('splitDateChip', () => {
  it('月と日をチップ用に分解する', () => {
    expect(splitDateChip('2026-07-05')).toEqual({ month: '7月', day: '5' })
  })
  it('1桁の月日はゼロ埋めを外す', () => {
    expect(splitDateChip('2026-01-09')).toEqual({ month: '1月', day: '9' })
  })
})
