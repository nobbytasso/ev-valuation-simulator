// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createScenario } from '../../../store/defaultInputs.ts'
import type { Scenario } from '../../../store/scenarioTypes.ts'
import { EcD2cScenarioView } from './EcD2cScenarioView.tsx'

afterEach(() => {
  cleanup()
})

function buildEcD2cScenario() {
  const scenario = createScenario('ec_d2c', 'テストEC/D2Cシナリオ')
  if (scenario.sector !== 'ec_d2c') throw new Error('unreachable')
  return scenario
}

describe('EcD2cScenarioView', () => {
  it('EVレンジ・LTV/CAC・コントリビューションマージン率・VC法の含意IRRを表示する', async () => {
    const scenario = buildEcD2cScenario()
    render(<EcD2cScenarioView scenario={scenario} onSave={vi.fn()} onDelete={vi.fn()} />)

    expect(await screen.findByText('企業価値(百万円)')).toBeInTheDocument()
    expect(screen.getByText(/LTV\/CAC: 3\.46/)).toBeInTheDocument()
    expect(screen.getByText(/コントリビューションマージン率: 20\.0%/)).toBeInTheDocument()
    expect(await screen.findByText(/が含意するIRR/)).toBeInTheDocument()
  })

  it('プリセット選択はdraftのみ差し替え、即保存はしない(C-7: 適用≠保存)', async () => {
    const user = userEvent.setup()
    const scenario = buildEcD2cScenario()
    const onSave = vi.fn()
    render(<EcD2cScenarioView scenario={scenario} onSave={onSave} onDelete={vi.fn()} />)

    const saveButton = screen.getByRole('button', { name: '保存' })
    expect(saveButton).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /① リピート育成成功/ }))

    expect(onSave).not.toHaveBeenCalled()
    expect(saveButton).not.toBeDisabled()

    await user.click(saveButton)

    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0] as Scenario
    if (saved.sector !== 'ec_d2c') throw new Error('unreachable')
    expect(saved.inputs.f2Rate).toBeCloseTo(0.4)
    expect(saved.inputs.adCostRatio).toBeCloseTo(0.15)
  })

  it('フォームで値を変更すると保存ボタンが有効になり、保存できる', async () => {
    const user = userEvent.setup()
    const scenario = buildEcD2cScenario()
    const onSave = vi.fn()
    render(<EcD2cScenarioView scenario={scenario} onSave={onSave} onDelete={vi.fn()} />)

    const saveButton = screen.getByRole('button', { name: '保存' })
    expect(saveButton).toBeDisabled()

    const revenueInput = screen.getByLabelText('年間売上(百万円)')
    await user.clear(revenueInput)
    await user.type(revenueInput, '3000')

    expect(saveButton).not.toBeDisabled()
    await user.click(saveButton)

    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0] as Scenario
    if (saved.sector !== 'ec_d2c') throw new Error('unreachable')
    expect(saved.inputs.annualRevenue).toBe(3000)
  })

  it('ベンチマーク比較セクションにダミーバッジと業界標準比の差分を表示する', async () => {
    const scenario = buildEcD2cScenario()
    render(<EcD2cScenarioView scenario={scenario} onSave={vi.fn()} onDelete={vi.fn()} />)

    expect(await screen.findByRole('status')).toHaveTextContent('ダミーデータ')
    // f2Rate既定35% vs 業界標準28% → +7.0pt
    expect(await screen.findByText(/業界標準比 \+7\.0pt/)).toBeInTheDocument()
  })

  it('マルチプル適用基準を粗利にするとEV/売上マルチプルの比較行が非表示になる', async () => {
    const user = userEvent.setup()
    const scenario = buildEcD2cScenario()
    render(<EcD2cScenarioView scenario={scenario} onSave={vi.fn()} onDelete={vi.fn()} />)

    await screen.findByText('EV/売上マルチプル(ベース)')

    await user.selectOptions(screen.getByLabelText('マルチプル適用基準'), 'grossProfit')

    expect(screen.queryByText('EV/売上マルチプル(ベース)')).not.toBeInTheDocument()
  })

  it('削除ボタンでonDeleteが呼ばれる', async () => {
    const user = userEvent.setup()
    const scenario = buildEcD2cScenario()
    const onDelete = vi.fn()
    render(<EcD2cScenarioView scenario={scenario} onSave={vi.fn()} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: 'シナリオを削除' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
