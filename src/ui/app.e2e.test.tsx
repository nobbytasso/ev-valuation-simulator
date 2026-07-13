// @vitest-environment jsdom
/**
 * E2E相当のテスト(Vitest + jsdom + React Testing Library)。
 * Stage 1はPlaywright等を導入しておらず、実ブラウザでの検証はスコープ外のため、
 * 実際の localStorage・DOM操作を通した統合テストで「保存→リロード→復元」
 * 「テーマ切替の永続化」を検証する(docs/requirements-rev4.md Phase 2 完了条件)。
 *
 * 「リロード」は、React コンポーネントを一度 unmount した上で Zustand ストアの
 * インメモリ状態を明示的にリセットし(実際のページリロードでJSヒープが消えるのと等価)、
 * localStorage はそのまま残した状態で再度 mount することでシミュレートする。
 */
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../App.tsx'
import { THEME_STORAGE_KEY } from '../theme/themeContext.ts'
import { useScenarioStore } from '../store/scenarioStore.ts'

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  useScenarioStore.setState({ scenarios: [], isLoaded: false })
})

afterEach(() => {
  cleanup()
})

describe('シナリオ保存→リロード→復元', () => {
  it('新規作成したシナリオがページ再読込(再mount)後も一覧に復元される', async () => {
    const user = userEvent.setup()

    const { unmount } = render(<App />)

    expect(await screen.findByRole('heading', { name: 'シナリオ一覧' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '新規作成' }))

    const createdRow = await screen.findByText(/新規シナリオ/)
    expect(createdRow).toBeInTheDocument()
    const scenarioName = createdRow.textContent

    // localStorageに実際に永続化されていることを直接確認する
    const raw = window.localStorage.getItem('ev-valuation-simulator:scenarios:v1')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw as string)).toHaveLength(1)

    // 「リロード」: コンポーネントをunmountし、Zustandのインメモリ状態を消す
    // (localStorageは実ブラウザのリロードと同様に残ったまま)
    unmount()
    useScenarioStore.setState({ scenarios: [], isLoaded: false })

    render(<App />)

    const restoredRow = await screen.findByText(scenarioName as string)
    expect(restoredRow).toBeInTheDocument()
  })

  it('複製・削除がlocalStorageに反映される', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '新規作成' }))
    await screen.findByText(/新規シナリオ/)

    await user.click(screen.getByRole('button', { name: '複製' }))
    await screen.findByText(/新規シナリオ.*\(コピー\)/)

    let raw = JSON.parse(window.localStorage.getItem('ev-valuation-simulator:scenarios:v1') as string)
    expect(raw).toHaveLength(2)

    const rows = screen.getAllByRole('row').slice(1) // ヘッダー行を除く
    const firstRowDeleteButton = within(rows[0]).getByRole('button', { name: '削除' })
    await user.click(firstRowDeleteButton)

    raw = JSON.parse(window.localStorage.getItem('ev-valuation-simulator:scenarios:v1') as string)
    expect(raw).toHaveLength(1)
  })
})

describe('テーマ切替の永続化', () => {
  it('切替後、再読込(再mount)してもテーマ選択が復元される', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)

    // 既定はダーク
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')

    await user.click(screen.getByRole('button', { name: 'テーマ切替' }))

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')

    // 「リロード」: unmountしてもlocalStorageは残る
    unmount()
    document.documentElement.removeAttribute('data-theme')

    render(<App />)

    expect(await screen.findByRole('button', { name: 'テーマ切替' })).toBeInTheDocument()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})
