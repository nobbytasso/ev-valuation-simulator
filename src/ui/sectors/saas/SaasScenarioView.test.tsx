// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createScenario } from '../../../store/defaultInputs.ts'
import type { Scenario } from '../../../store/scenarioTypes.ts'
import { SaasScenarioView } from './SaasScenarioView.tsx'

afterEach(() => {
  cleanup()
})

function buildSaasScenario() {
  const scenario = createScenario('saas_jp', 'テストSaaSシナリオ')
  if (scenario.sector !== 'saas_jp') throw new Error('unreachable')
  return scenario
}

describe('SaasScenarioView', () => {
  it('EVレンジ・Rule of 40・VC法の含意IRRを表示する', async () => {
    const scenario = buildSaasScenario()
    render(<SaasScenarioView scenario={scenario} onSave={vi.fn()} onDelete={vi.fn()} />)

    expect(await screen.findByText('企業価値(百万円)')).toBeInTheDocument()
    expect(screen.getByText(/Rule of 40: 35\.0 pt/)).toBeInTheDocument()
    expect(await screen.findByText(/が含意するIRR/)).toBeInTheDocument()
  })

  it('プリセット選択はdraftのみ差し替え、即保存はしない(C-7: 適用≠保存)', async () => {
    const user = userEvent.setup()
    const scenario = buildSaasScenario()
    const onSave = vi.fn()
    render(<SaasScenarioView scenario={scenario} onSave={onSave} onDelete={vi.fn()} />)

    const saveButton = screen.getByRole('button', { name: '保存' })
    expect(saveButton).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /① 順調/ }))

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByLabelText('ARR成長率(YoY, %)')).toHaveValue(35)
    expect(saveButton).not.toBeDisabled()

    await user.click(saveButton)

    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0] as Scenario
    if (saved.sector !== 'saas_jp') throw new Error('unreachable')
    expect(saved.inputs.arrGrowth).toBeCloseTo(0.35)
    expect(saved.inputs.operatingMargin).toBeCloseTo(0.08)
  })

  it('フォームで値を変更すると保存ボタンが有効になり、保存できる', async () => {
    const user = userEvent.setup()
    const scenario = buildSaasScenario()
    const onSave = vi.fn()
    render(<SaasScenarioView scenario={scenario} onSave={onSave} onDelete={vi.fn()} />)

    const saveButton = screen.getByRole('button', { name: '保存' })
    expect(saveButton).toBeDisabled()

    const arrInput = screen.getByLabelText('ARR(百万円)')
    await user.clear(arrInput)
    await user.type(arrInput, '2000')

    expect(saveButton).not.toBeDisabled()
    await user.click(saveButton)

    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0] as Scenario
    if (saved.sector !== 'saas_jp') throw new Error('unreachable')
    expect(saved.inputs.arr).toBe(2000)
  })

  it('ベンチマーク比較セクションにダミーバッジと業界標準比の差分を表示する', async () => {
    const scenario = buildSaasScenario()
    render(<SaasScenarioView scenario={scenario} onSave={vi.fn()} onDelete={vi.fn()} />)

    expect(await screen.findByRole('status')).toHaveTextContent('ダミーデータ')
    // arrGrowth既定30% vs 業界標準25% → +5.0pt
    expect(await screen.findByText(/業界標準比 \+5\.0pt/)).toBeInTheDocument()
  })

  it('削除ボタンでonDeleteが呼ばれる', async () => {
    const user = userEvent.setup()
    const scenario = buildSaasScenario()
    const onDelete = vi.fn()
    render(<SaasScenarioView scenario={scenario} onSave={vi.fn()} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: 'シナリオを削除' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('VC法の投資額を変更すると必要持分の再計算に反映される', async () => {
    const user = userEvent.setup()
    const scenario = buildSaasScenario()
    render(<SaasScenarioView scenario={scenario} onSave={vi.fn()} onDelete={vi.fn()} />)

    const investmentInput = await screen.findByLabelText('投資額(百万円)')
    const row = screen.getByText('投資時必要持分').closest('tr') as HTMLElement
    const before = row.textContent

    await user.clear(investmentInput)
    await user.type(investmentInput, '900')

    expect(row.textContent).not.toBe(before)
  })
})
