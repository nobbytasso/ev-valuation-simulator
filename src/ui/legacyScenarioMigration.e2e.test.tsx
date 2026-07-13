// @vitest-environment jsdom
/**
 * D-1回帰テスト(E2E相当): Phase 2形式(schemaVersion/vcMethodなし)のシナリオが
 * localStorageに残っている状態でアプリを起動しても、シナリオ詳細ページ
 * (VcMethodSection)がクラッシュせず正しく描画されることを確認する。
 * 出典: docs/review-phase3.md D-1「旧シナリオデータでシナリオ詳細ページがクラッシュする」
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../App.tsx'
import { SCENARIO_STORAGE_KEY, useScenarioStore } from '../store/scenarioStore.ts'
import legacyScenarioV1 from '../store/fixtures/legacy-scenario-v1.json'

beforeEach(() => {
  window.localStorage.clear()
  useScenarioStore.setState({ scenarios: [], isLoaded: false })
})

afterEach(() => {
  cleanup()
})

describe('Phase2形式シナリオの読み込み回帰', () => {
  it('schemaVersion/vcMethodなしの生データが残っていてもシナリオ詳細ページがクラッシュしない', async () => {
    // Phase 2時点で保存された生データを直接 localStorage に置く(移行前の状態を再現)
    window.localStorage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify([legacyScenarioV1]))
    window.location.hash = `#/scenarios/${legacyScenarioV1.id}`

    render(<App />)

    // VC法セクション(vcMethodに依存)が例外を投げずに描画されることを確認
    expect(await screen.findByText('VC法 / IRR・MOIC')).toBeInTheDocument()
    expect(screen.getByText('Phase2形式レガシーシナリオ(SaaS)')).toBeInTheDocument()
    expect(screen.getByText(/が含意するIRR/)).toBeInTheDocument()
  })
})
