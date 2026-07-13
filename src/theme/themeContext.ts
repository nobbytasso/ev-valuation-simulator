import { createContext } from 'react'

export type ThemeName = 'dark' | 'light'

export const THEME_STORAGE_KEY = 'ev-valuation-simulator:theme'

export interface ThemeContextValue {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
