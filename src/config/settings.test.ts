import { describe, it, expect } from 'vitest'
import { SETTINGS } from './settings'

describe('SETTINGS', () => {
  it('maxFileSizeBytes は正の数である', () => {
    expect(SETTINGS.maxFileSizeBytes).toBeGreaterThan(0)
  })
  it('maxCategoryOptions は正の数である', () => {
    expect(SETTINGS.maxCategoryOptions).toBeGreaterThan(0)
  })
})
