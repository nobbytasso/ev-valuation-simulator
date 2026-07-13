// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createScenario } from '../../../store/defaultInputs.ts'
import type { Scenario } from '../../../store/scenarioTypes.ts'
import { DrugDiscoveryScenarioView } from './DrugDiscoveryScenarioView.tsx'

afterEach(() => {
  cleanup()
})

function buildDrugDiscoveryScenario() {
  const scenario = createScenario('drug_discovery', 'テスト創薬シナリオ')
  if (scenario.sector !== 'drug_discovery') throw new Error('unreachable')
  return scenario
}

describe('DrugDiscoveryScenarioView', () => {
  it('EVレンジ・品目ごとの上市確率(POS)・VC法の含意IRRを表示する', async () => {
    const scenario = buildDrugDiscoveryScenario()
    render(<DrugDiscoveryScenarioView scenario={scenario} onSave={vi.fn()} onDelete={vi.fn()} />)

    expect(await screen.findByText('企業価値(百万円)')).toBeInTheDocument()
    // phase2(35%)*phase3(60%)*filing(85%) = 17.85% → 17.8%(浮動小数点)
    expect(screen.getByText(/上市確率\(POS\) 17\.8%/)).toBeInTheDocument()
    expect(await screen.findByText(/が含意するIRR/)).toBeInTheDocument()
  })

  it('プリセット選択で入力値が切り替わり、保存される(導出成功=ライセンス型)', async () => {
    const user = userEvent.setup()
    const scenario = buildDrugDiscoveryScenario()
    const onSave = vi.fn()
    render(<DrugDiscoveryScenarioView scenario={scenario} onSave={onSave} onDelete={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /② 導出成功/ }))

    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0] as Scenario
    if (saved.sector !== 'drug_discovery') throw new Error('unreachable')
    const commercialization = saved.inputs.assets[0].commercialization
    expect(commercialization.type).toBe('license')
    if (commercialization.type === 'license') {
      expect(commercialization.royaltyRate).toBeCloseTo(0.15)
      expect(commercialization.milestones).toHaveLength(2)
    }
  })

  it('フォームで品目名を変更すると保存ボタンが有効になり、保存できる', async () => {
    const user = userEvent.setup()
    const scenario = buildDrugDiscoveryScenario()
    const onSave = vi.fn()
    render(<DrugDiscoveryScenarioView scenario={scenario} onSave={onSave} onDelete={vi.fn()} />)

    const saveButton = screen.getByRole('button', { name: '保存' })
    expect(saveButton).toBeDisabled()

    const nameInput = screen.getByLabelText('品目名')
    await user.clear(nameInput)
    await user.type(nameInput, '改名後の品目')

    expect(saveButton).not.toBeDisabled()
    await user.click(saveButton)

    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0] as Scenario
    if (saved.sector !== 'drug_discovery') throw new Error('unreachable')
    expect(saved.inputs.assets[0].name).toBe('改名後の品目')
  })

  it('品目を追加・削除できる', async () => {
    const user = userEvent.setup()
    const scenario = buildDrugDiscoveryScenario()
    render(<DrugDiscoveryScenarioView scenario={scenario} onSave={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getAllByLabelText('品目名')).toHaveLength(1)
    const removeButtons = screen.getAllByRole('button', { name: 'この品目を削除' })
    expect(removeButtons[0]).toBeDisabled() // 唯一の品目は削除不可

    await user.click(screen.getByRole('button', { name: '＋ 品目を追加' }))
    expect(screen.getAllByLabelText('品目名')).toHaveLength(2)

    const removeButtonsAfterAdd = screen.getAllByRole('button', { name: 'この品目を削除' })
    expect(removeButtonsAfterAdd[0]).not.toBeDisabled()
    await user.click(removeButtonsAfterAdd[1])
    expect(screen.getAllByLabelText('品目名')).toHaveLength(1)
  })

  it('ベンチマーク比較セクションにダミーバッジと業界標準比の差分を表示する(自社販売はロイヤリティ率比較を除外)', async () => {
    const scenario = buildDrugDiscoveryScenario()
    render(<DrugDiscoveryScenarioView scenario={scenario} onSave={vi.fn()} onDelete={vi.fn()} />)

    expect(await screen.findByRole('status')).toHaveTextContent('ダミーデータ')
    // preclinical成功確率50% vs 業界標準65% → -15.0pt
    expect(await screen.findByText(/業界標準比 -15\.0pt/)).toBeInTheDocument()
    // 割引率base 11% vs 業界標準11% → +0.0pt
    expect(await screen.findByText(/業界標準比 \+0\.0pt/)).toBeInTheDocument()
    // 既定は自社販売のためロイヤリティ率の比較は表示されない
    expect(screen.queryByText(/ロイヤリティ率/)).not.toBeInTheDocument()
  })

  it('導出(ライセンス)型に切り替えるとロイヤリティ率とマイルストーンの入力が表示される', async () => {
    const user = userEvent.setup()
    const scenario = buildDrugDiscoveryScenario()
    render(<DrugDiscoveryScenarioView scenario={scenario} onSave={vi.fn()} onDelete={vi.fn()} />)

    await user.selectOptions(screen.getByLabelText('販売方式'), 'license')

    expect(await screen.findByLabelText('ロイヤリティ率(%)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '＋ マイルストーンを追加' }))
    expect(await screen.findByLabelText('金額(百万円)')).toBeInTheDocument()
  })

  it('削除ボタンでonDeleteが呼ばれる', async () => {
    const user = userEvent.setup()
    const scenario = buildDrugDiscoveryScenario()
    const onDelete = vi.fn()
    render(<DrugDiscoveryScenarioView scenario={scenario} onSave={vi.fn()} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: 'シナリオを削除' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
