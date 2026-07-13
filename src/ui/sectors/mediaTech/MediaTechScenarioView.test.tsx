// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createScenario } from '../../../store/defaultInputs.ts'
import type { Scenario } from '../../../store/scenarioTypes.ts'
import { MediaTechScenarioView } from './MediaTechScenarioView.tsx'

afterEach(() => {
  cleanup()
})

function buildMediaTechScenario() {
  const scenario = createScenario('media_tech', 'テストメディアシナリオ')
  if (scenario.sector !== 'media_tech') throw new Error('unreachable')
  return scenario
}

describe('MediaTechScenarioView', () => {
  it('EVレンジ・LTV/CPA・VC法の含意IRRを表示する', async () => {
    const scenario = buildMediaTechScenario()
    render(<MediaTechScenarioView scenario={scenario} onSave={vi.fn()} onDelete={vi.fn()} />)

    expect(await screen.findByText('企業価値(百万円)')).toBeInTheDocument()
    expect(screen.getByText(/LTV\/CPA: 2\.97/)).toBeInTheDocument()
    expect(await screen.findByText(/が含意するIRR/)).toBeInTheDocument()
  })

  it('プリセット選択はdraftのみ差し替え、即保存はしない(C-7: 適用≠保存)', async () => {
    const user = userEvent.setup()
    const scenario = buildMediaTechScenario()
    const onSave = vi.fn()
    render(<MediaTechScenarioView scenario={scenario} onSave={onSave} onDelete={vi.fn()} />)

    const saveButton = screen.getByRole('button', { name: '保存' })
    expect(saveButton).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /② 課金転換率改善/ }))

    expect(onSave).not.toHaveBeenCalled()
    expect(saveButton).not.toBeDisabled()

    await user.click(saveButton)

    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0] as Scenario
    if (saved.sector !== 'media_tech') throw new Error('unreachable')
    expect(saved.inputs.arpuMonthly.paid).toBe(150)
    expect(saved.inputs.monthlyChurn).toBeCloseTo(0.03)
  })

  it('フォームで値を変更すると保存ボタンが有効になり、保存できる', async () => {
    const user = userEvent.setup()
    const scenario = buildMediaTechScenario()
    const onSave = vi.fn()
    render(<MediaTechScenarioView scenario={scenario} onSave={onSave} onDelete={vi.fn()} />)

    const saveButton = screen.getByRole('button', { name: '保存' })
    expect(saveButton).toBeDisabled()

    const mauInput = screen.getByLabelText('MAU(人)')
    await user.clear(mauInput)
    await user.type(mauInput, '5000000')

    expect(saveButton).not.toBeDisabled()
    await user.click(saveButton)

    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0] as Scenario
    if (saved.sector !== 'media_tech') throw new Error('unreachable')
    expect(saved.inputs.mau).toBe(5000000)
  })

  it('ベンチマーク比較セクションにダミーバッジと業界標準比の差分を表示する', async () => {
    const scenario = buildMediaTechScenario()
    render(<MediaTechScenarioView scenario={scenario} onSave={vi.fn()} onDelete={vi.fn()} />)

    expect(await screen.findByRole('status')).toHaveTextContent('ダミーデータ')
    // monthlyChurn既定5% → 12ヶ月継続率54.0% vs 業界標準28% → +26.0pt
    expect(await screen.findByText(/業界標準比 \+26\.0pt/)).toBeInTheDocument()
    // ev_sales_multiple(業界標準比+2.0x)。Compsマーカーはchart内SVG描画のため
    // jsdomのゼロサイズコンテナでは検証しない(BenchmarkBarへのprops受け渡しで担保)
    expect(await screen.findByText(/業界標準比 \+2\.0x/)).toBeInTheDocument()
  })

  it('削除ボタンでonDeleteが呼ばれる', async () => {
    const user = userEvent.setup()
    const scenario = buildMediaTechScenario()
    const onDelete = vi.fn()
    render(<MediaTechScenarioView scenario={scenario} onSave={vi.fn()} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: 'シナリオを削除' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
