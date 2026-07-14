import { useState, useEffect, useCallback } from 'react'

export type Theme = 'light' | 'dark' | 'fancy'

export function getInitialTheme(): Theme {
  const stored = localStorage.getItem('theme')
  return stored === 'dark' || stored === 'fancy' ? stored : 'light'
}

export function nextTheme(current: Theme): Theme {
  switch (current) {
    case 'light':
      return 'dark'
    case 'dark':
      return 'fancy'
    default:
      return 'light'
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const cycleTheme = useCallback(() => {
    setTheme(nextTheme)
  }, [])

  return { theme, cycleTheme }
}
