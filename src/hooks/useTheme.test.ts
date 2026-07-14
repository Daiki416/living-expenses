import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getInitialTheme, nextTheme } from './useTheme'

describe('getInitialTheme', () => {
  beforeEach(() => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
    })
  })

  it('未設定なら light', () => {
    expect(getInitialTheme()).toBe('light')
  })
  it("localStorage が 'light' なら light", () => {
    localStorage.setItem('theme', 'light')
    expect(getInitialTheme()).toBe('light')
  })
  it("localStorage が 'dark' なら dark", () => {
    localStorage.setItem('theme', 'dark')
    expect(getInitialTheme()).toBe('dark')
  })
  it("localStorage が 'fancy' なら fancy", () => {
    localStorage.setItem('theme', 'fancy')
    expect(getInitialTheme()).toBe('fancy')
  })
  it('不正値なら light にフォールバック', () => {
    localStorage.setItem('theme', 'sparkle')
    expect(getInitialTheme()).toBe('light')
  })
})

describe('nextTheme', () => {
  it('light → dark → fancy → light の順送り', () => {
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('fancy')
    expect(nextTheme('fancy')).toBe('light')
  })
})
