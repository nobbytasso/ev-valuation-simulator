// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createScenario } from '../../../store/defaultInputs.ts'
import type { Scenario } from '../../../store/scenarioTypes.ts'
import { MedicalDeviceScenarioView } from './MedicalDeviceScenarioView.tsx'

afterEach(() => {
  cleanup()
})

function buildMedicalDeviceScenario() {
  const scenario = createScenario('medical_device', 'テスト医療機器シナリオ')
  if (scenario.sector !== 'medical_device') throw new Error('unreachable')
  return scenario
}

describe('MedicalDeviceScenarioView', () => {
  it('EVレンジ・VC法の含意IRRを表示する', async () => {
    const scenario = buildMedicalDeviceScenario()
    render(<MedicalDeviceScenarioView scenario={scenario} onSave={vi.fn()} onDelete={vi.fn()} />)

    expect(await screen.findByText('企業価値(百万円)')).toBeInTheDocument()
    expect(await screen.findByText(/が含意するIRR/)).toBeInTheDocument()
  })

  it('プリセット選択で入力値が切り替わり、保存される', async () => {
    const user = userEvent.setup()
    const scenario = buildMedicalDeviceScenario()
    const onSave = vi.fn()
    render(<MedicalDeviceScenarioView scenario={scenario} onSave={onSave} onDelete={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /① 承認遅延/ }))

    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0] as Scenario
    if (saved.sector !== 'medical_device') throw new Error('unreachable')
    expect(saved.inputs.deviceClass).toBe('III')
    expect(saved.inputs.approvalDelayYears).toBe(3)
  })

  it('フォームで値を変更すると保存ボタンが有効になり、保存できる', async () => {
    const user = userEvent.setup()
    const scenario = buildMedicalDeviceScenario()
    const onSave = vi.fn()
    render(<MedicalDeviceScenarioView scenario={scenario} onSave={onSave} onDelete={vi.fn()} />)

    const saveButton = screen.getByRole('button', { name: '保存' })
    expect(saveButton).toBeDisabled()

    const proceduresInput = screen.getByLabelText('年間対象手技数')
    await user.clear(proceduresInput)
    await user.type(proceduresInput, '9000')

    expect(saveButton).not.toBeDisabled()
    await user.click(saveButton)

    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0] as Scenario
    if (saved.sector !== 'medical_device') throw new Error('unreachable')
    expect(saved.inputs.annualProcedures).toBe(9000)
  })

  it('ベンチマーク比較セクションにダミーバッジと業界標準比の差分を表示する(Class III以外は承認期間の比較を除外)', async () => {
    const scenario = buildMedicalDeviceScenario()
    render(<MedicalDeviceScenarioView scenario={scenario} onSave={vi.fn()} onDelete={vi.fn()} />)

    expect(await screen.findByRole('status')).toHaveTextContent('ダミーデータ')
    // peakPenetration既定30%, yearsToPeak既定4 → 5年目浸透率30.0% vs 業界標準8% → +22.0pt
    expect(await screen.findByText(/業界標準比 \+22\.0pt/)).toBeInTheDocument()
    // recurringRatio既定20% vs 業界標準40% → -20.0pt
    expect(await screen.findByText(/業界標準比 -20\.0pt/)).toBeInTheDocument()
    // deviceClass既定'II'のため承認期間の比較は表示されない
    expect(screen.queryByText('承認までの想定期間(年)')).not.toBeInTheDocument()
  })

  it('クラスをIIIに変更すると承認までの想定期間の比較が表示される', async () => {
    const user = userEvent.setup()
    const scenario = buildMedicalDeviceScenario()
    render(<MedicalDeviceScenarioView scenario={scenario} onSave={vi.fn()} onDelete={vi.fn()} />)

    await user.selectOptions(screen.getByLabelText('クラス分類'), 'III')

    expect(await screen.findByText('承認までの想定期間(年)')).toBeInTheDocument()
    // launchYear既定2年 vs 業界標準2.5年 → -0.5
    expect(await screen.findByText(/業界標準比 -0\.5/)).toBeInTheDocument()
  })

  it('削除ボタンでonDeleteが呼ばれる', async () => {
    const user = userEvent.setup()
    const scenario = buildMedicalDeviceScenario()
    const onDelete = vi.fn()
    render(<MedicalDeviceScenarioView scenario={scenario} onSave={vi.fn()} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: 'シナリオを削除' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
