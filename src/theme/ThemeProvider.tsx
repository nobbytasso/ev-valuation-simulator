/**
 * テーマ切替+永続化。出典: docs/requirements-rev4.md §5
 * 既定はダーク(FUI)。システムのprefers-color-schemeには従わない(要件上、明示的に既定はダーク)。
 * 選択はlocalStorageに永続化し、切替時は data-theme 属性の書き換えのみで反映する
 * (レイアウト構造は共通、トークンのみ切り替わる)。
 */
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ThemeContext, THEME_STORAGE_KEY } from './themeContext.ts'
import type { ThemeName } from './themeContext.ts'

function readStoredTheme(): ThemeName {
  if (typeof window === 'undefined') return 'dark'
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return stored === 'light' ? 'light' : 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(readStoredTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const setTheme = useCallback((next: ThemeName) => setThemeState(next), [])
  const toggleTheme = useCallback(() => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark')), [])

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>
}
