import { useTheme } from '../theme/useTheme.ts'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button type="button" onClick={toggleTheme} aria-label="テーマ切替">
      {theme === 'dark' ? 'ライトモードへ切替' : 'ダークモードへ切替'}
    </button>
  )
}
