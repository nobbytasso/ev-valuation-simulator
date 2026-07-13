// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createScenario } from '../../../store/defaultInputs.ts'
import type { Scenario } from '../../../store/scenarioTypes.ts'
import { ClimateTechScenarioView } from './ClimateTechScenarioView.tsx'

afterEach(() => {
  cleanup()
})

function buildClimateTechScenario() {
  const scenario = createScenario('climate_tech', 'テストクライメートシナリオ')
  if (scenario.sector !== 'climate_tech') throw new Error('unreachable')
  return scenario
}

describe('ClimateTechScenarioView', () => {
  it('EVレンジ・VC法の含意IRRを表示する', async () => {
    const scenario = buildClimateTechScenario()
    render(<ClimateTechScenarioView scenario={scenario} onSave={vi.fn()} onDelete={vi.fn()} />)

    expect(await screen.findByText('企業価値(百万円)')).toBeInTheDocument()
    expect(await screen.findByText(/が含意するIRR/)).toBeInTheDocument()
  })

  it('プリセット選択で入力値が切り替わり、保存される', async () => {
    const user = userEvent.setup()
    const scenario = buildClimateTechScenario()
    const onSave = vi.fn()
    render(<ClimateTechScenarioView scenario={scenario} onSave={onSave} onDelete={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /① 制度追い風\+オフテイク確保/ }))

    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0] as Scenario
    if (saved.sector !== 'climate_tech') throw new Error('unreachable')
    expect(saved.inputs.offtakeCoverage).toBeCloseTo(0.7)
    expect(saved.inputs.subsidyCoverage).toBeCloseTo(0.4)
  })

  it('フォームで値を変更すると保存ボタンが有効になり、保存できる', async () => {
    const user = userEvent.setup()
    const scenario = buildClimateTechScenario()
    const onSave = vi.fn()
    render(<ClimateTechScenarioView scenario={scenario} onSave={onSave} onDelete={vi.fn()} />)

    const saveButton = screen.getByRole('button', { name: '保存' })
    expect(saveButton).toBeDisabled()

    const priceInput = screen.getByLabelText('販売単価(円/unit)')
    await user.clear(priceInput)
    await user.type(priceInput, '9500')

    expect(saveButton).not.toBeDisabled()
    await user.click(saveButton)

    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0] as Scenario
    if (saved.sector !== 'climate_tech') throw new Error('unreachable')
    expect(saved.inputs.unitPrice).toBe(9500)
  })

  it('CAPEXスケジュールの行を追加・削除できる', async () => {
    const user = userEvent.setup()
    const scenario = buildClimateTechScenario()
    render(<ClimateTechScenarioView scenario={scenario} onSave={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getAllByLabelText('金額(百万円)')).toHaveLength(2) // 既定は2行

    await user.click(screen.getByRole('button', { name: '＋ CAPEXを追加' }))
    expect(screen.getAllByLabelText('金額(百万円)')).toHaveLength(3)

    const removeButtons = screen.getAllByRole('button', { name: '削除' })
    await user.click(removeButtons[removeButtons.length - 1])
    expect(screen.getAllByLabelText('金額(百万円)')).toHaveLength(2)
  })

  it('ベンチマーク比較セクションにダミーバッジと業界標準比の差分を表示する', async () => {
    const scenario = buildClimateTechScenario()
    render(<ClimateTechScenarioView scenario={scenario} onSave={vi.fn()} onDelete={vi.fn()} />)

    expect(await screen.findByRole('status')).toHaveTextContent('ダミーデータ')
    // offtakeCoverage既定40% vs 業界標準45% → -5.0pt
    expect(await screen.findByText(/業界標準比 -5\.0pt/)).toBeInTheDocument()
    // massProductionProb既定60% vs 業界標準45% → +15.0pt
    expect(await screen.findByText(/業界標準比 \+15\.0pt/)).toBeInTheDocument()
  })

  it('削除ボタンでonDeleteが呼ばれる', async () => {
    const user = userEvent.setup()
    const scenario = buildClimateTechScenario()
    const onDelete = vi.fn()
    render(<ClimateTechScenarioView scenario={scenario} onSave={vi.fn()} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: 'シナリオを削除' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
