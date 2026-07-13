// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { createScenario } from '../../store/defaultInputs.ts'
import type { Scenario } from '../../store/scenarioTypes.ts'
import { SensitivitySection } from './SensitivitySection.tsx'
import { buildTornadoRows } from './sensitivityRegistry.ts'

afterEach(() => {
  cleanup()
})

function saasScenario(overrides: Partial<Extract<Scenario, { sector: 'saas_jp' }>['inputs']> = {}) {
  const scenario = createScenario('saas_jp', 'テスト')
  if (scenario.sector !== 'saas_jp') throw new Error('unreachable')
  return { ...scenario, inputs: { ...scenario.inputs, ...overrides } }
}

function medicalDeviceScenario() {
  const scenario = createScenario('medical_device', 'テスト')
  if (scenario.sector !== 'medical_device') throw new Error('unreachable')
  return scenario
}

function drugDiscoveryScenarioWithManyAssets() {
  const scenario = createScenario('drug_discovery', 'テスト')
  if (scenario.sector !== 'drug_discovery') throw new Error('unreachable')
  const [asset] = scenario.inputs.assets
  const assets = [
    { ...asset, name: '品目A', currentPhase: 'preclinical' as const },
    { ...asset, name: '品目B', currentPhase: 'preclinical' as const, launchYear: 8 },
    { ...asset, name: '品目C', currentPhase: 'preclinical' as const, launchYear: 9 },
  ]
  return { ...scenario, inputs: { ...scenario.inputs, assets } }
}

describe('SensitivitySection: ユニットエコノミクス注記(P4-1追加指示、§3.1)', () => {
  it('SaaSでは注記が表示される', () => {
    render(<SensitivitySection scenario={saasScenario()} />)
    expect(screen.getByText(/マルチプル法のため/)).toBeInTheDocument()
  })

  it('医療機器では注記が表示されない', () => {
    render(<SensitivitySection scenario={medicalDeviceScenario()} />)
    expect(screen.queryByText(/マルチプル法のため/)).not.toBeInTheDocument()
  })
})

describe('SensitivitySection: 感度なしグループ(P4-3、§3.4)', () => {
  it('arrBasis=currentのときarrGrowthは「この変動幅では感度なし」に列挙される', () => {
    const scenario = saasScenario({ arrBasis: 'current' })
    render(<SensitivitySection scenario={scenario} />)
    expect(screen.getByText('この変動幅では感度なし:')).toBeInTheDocument()
    expect(screen.getByText('ARR成長率')).toBeInTheDocument()
    // 感度のあるドライバーはテーブル側(td)に表示される
    const table = screen.getByRole('table')
    expect(table.textContent).toContain('EV/ARRマルチプル(ベース)')
  })
})

describe('SensitivitySection: ドメイン外入力でエラー表示(§1.3)', () => {
  it('baseEvがNaNになる入力ではチャートを描画せずエラーメッセージを表示する', () => {
    const scenario = saasScenario({ arr: -1 })
    render(<SensitivitySection scenario={scenario} />)
    expect(screen.getByRole('alert')).toHaveTextContent('入力エラーのため感度分析を実行できません。')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('SensitivitySection: 上位N制限とトグル(§3.3)', () => {
  it('span降順の上位10件のみ表示し、トグルで残りを展開する', async () => {
    const user = userEvent.setup()
    const scenario = drugDiscoveryScenarioWithManyAssets()
    const { rows } = buildTornadoRows(scenario, { defaultDelta: 0.2 })
    const meaningfulCount = rows.filter((r) => r.span > 1e-6).length
    expect(meaningfulCount).toBeGreaterThan(10)

    render(<SensitivitySection scenario={scenario} />)
    const table = screen.getByRole('table')
    expect(table.querySelectorAll('tbody tr').length).toBe(10)
    const toggle = screen.getByRole('button', { name: `残り${meaningfulCount - 10}件を表示` })

    await user.click(toggle)

    expect(table.querySelectorAll('tbody tr').length).toBe(meaningfulCount)
    expect(screen.queryByRole('button', { name: /残り.*件を表示/ })).not.toBeInTheDocument()
  })
})

describe('SensitivitySection: δ変更で再計算(§3.2)', () => {
  it('既定変動幅を変更すると表示されるspanが再計算される', async () => {
    const user = userEvent.setup()
    const scenario = medicalDeviceScenario()
    const { rows: rowsAt20 } = buildTornadoRows(scenario, { defaultDelta: 0.2 })
    const { rows: rowsAt10 } = buildTornadoRows(scenario, { defaultDelta: 0.1 })
    const topDriverId = rowsAt20[0].driverId
    const spanAt10 = rowsAt10.find((r) => r.driverId === topDriverId)?.span as number
    const formattedSpanAt10 = `${spanAt10.toLocaleString('ja-JP', { maximumFractionDigits: 0 })} 百万円`

    render(<SensitivitySection scenario={scenario} />)
    const deltaInput = screen.getByLabelText(/既定変動幅/)
    await user.clear(deltaInput)
    await user.type(deltaInput, '10')

    const table = screen.getByRole('table')
    expect(table.textContent).toContain(formattedSpanAt10)
  })
})
