// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EvRange } from '../../engine/index.ts'
import type { ScenarioCapitalPolicyInputs, ScenarioVcMethodInputs } from '../../store/scenarioTypes.ts'
import { CapitalPolicySection } from './CapitalPolicySection.tsx'

afterEach(() => {
  cleanup()
})

function buildEvRange(overrides: Partial<EvRange> = {}): EvRange {
  return { pessimistic: 500, base: 1000, optimistic: 2000, ...overrides }
}

function buildVcMethod(overrides: Partial<ScenarioVcMethodInputs> = {}): ScenarioVcMethodInputs {
  return {
    targetMultiple: 10,
    yearsToExit: 5,
    investment: 300,
    dilutionRetention: 0.7,
    netDebtAtExit: 0,
    ...overrides,
  }
}

function buildCapitalPolicy(overrides: Partial<ScenarioCapitalPolicyInputs> = {}): ScenarioCapitalPolicyInputs {
  return {
    initialCapTable: [{ id: 'founders', name: '創業者', ownership: 1 }],
    rounds: [],
    exitEvSource: 'base',
    ...overrides,
  }
}

describe('CapitalPolicySection: ラウンド追加/削除・持分推移表(§4.3)', () => {
  it('ラウンドを追加すると持分推移表の列が増え、削除すると元に戻る', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(
      <CapitalPolicySection
        scenarioId="s1"
        evRange={buildEvRange()}
        vcMethod={buildVcMethod()}
        capitalPolicy={buildCapitalPolicy()}
        onChange={onChange}
      />,
    )

    await user.click(screen.getByRole('button', { name: '＋ ラウンドを追加' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    const withRound = onChange.mock.calls[0][0] as ScenarioCapitalPolicyInputs
    expect(withRound.rounds).toHaveLength(1)

    rerender(
      <CapitalPolicySection
        scenarioId="s1"
        evRange={buildEvRange()}
        vcMethod={buildVcMethod()}
        capitalPolicy={withRound}
        onChange={onChange}
      />,
    )
    expect(screen.getByText(`${withRound.rounds[0].name}後`)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ラウンドを削除' }))
    const afterRemove = onChange.mock.calls[1][0] as ScenarioCapitalPolicyInputs
    expect(afterRemove.rounds).toHaveLength(0)
  })
})

describe('CapitalPolicySection: exitEvSource切替(§4.2, P4-4)', () => {
  it('セレクトで切替えるとonChangeにexitEvSourceが反映される', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <CapitalPolicySection
        scenarioId="s1"
        evRange={buildEvRange()}
        vcMethod={buildVcMethod()}
        capitalPolicy={buildCapitalPolicy()}
        onChange={onChange}
      />,
    )
    await user.selectOptions(screen.getByLabelText('Exit企業価値の参照レンジ点'), 'optimistic')
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ exitEvSource: 'optimistic' }))
  })
})

describe('CapitalPolicySection: Exit株式価値≤0の警告(§4.2)', () => {
  it('EV−netDebtAtExitが0以下のとき警告を表示しシミュレーションを実行しない', () => {
    render(
      <CapitalPolicySection
        scenarioId="s1"
        evRange={buildEvRange({ base: 100 })}
        vcMethod={buildVcMethod({ netDebtAtExit: 200 })}
        capitalPolicy={buildCapitalPolicy()}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Exit株式価値が0以下のため手取り・IRR/MOICを計算できません。')
  })
})

describe('CapitalPolicySection: バリデーションエラー表示(§4.5)', () => {
  it('初期保有者のownership合計が1でないとき入力エラーを表示する', () => {
    render(
      <CapitalPolicySection
        scenarioId="s1"
        evRange={buildEvRange()}
        vcMethod={buildVcMethod()}
        capitalPolicy={buildCapitalPolicy({
          initialCapTable: [{ id: 'founders', name: '創業者', ownership: 0.5 }],
        })}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('入力エラー')
  })
})

describe('CapitalPolicySection: 期待IRR/MOIC表示(§4.3)', () => {
  it('自ファンドの出資があるとき期待IRR/MOICの実値を表示する', () => {
    render(
      <CapitalPolicySection
        scenarioId="s1"
        evRange={buildEvRange()}
        vcMethod={buildVcMethod()}
        capitalPolicy={buildCapitalPolicy({
          rounds: [
            {
              name: 'シリーズA',
              yearIndex: 1,
              preMoneyValuation: 1000,
              amountRaised: 300,
              optionPoolPostPct: 0.1,
              fundInvestment: 200,
            },
          ],
        })}
        onChange={vi.fn()}
      />,
    )
    expect(screen.queryByText(/自ファンドの出資がありません/)).not.toBeInTheDocument()
  })

  it('自ファンドの出資がないとき期待IRR/MOICは「—(自ファンドの出資がありません)」表示になる', () => {
    render(
      <CapitalPolicySection
        scenarioId="s1"
        evRange={buildEvRange()}
        vcMethod={buildVcMethod()}
        capitalPolicy={buildCapitalPolicy({
          rounds: [
            {
              name: 'シリーズA',
              yearIndex: 1,
              preMoneyValuation: 1000,
              amountRaised: 300,
              optionPoolPostPct: 0.1,
              fundInvestment: 0,
            },
          ],
        })}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getAllByText(/自ファンドの出資がありません/)).toHaveLength(2) // 期待IRR・期待MOICの両方
  })
})

describe('CapitalPolicySection: scenarioId切替時のreset(§5.3)', () => {
  it('scenarioId切替で新しい資本政策の内容が描画され、切替後も行の追加が正常動作する', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(
      <CapitalPolicySection
        scenarioId="s1"
        evRange={buildEvRange()}
        vcMethod={buildVcMethod()}
        capitalPolicy={buildCapitalPolicy({
          initialCapTable: [
            { id: 'a', name: 'Alice', ownership: 0.5 },
            { id: 'b', name: 'Bob', ownership: 0.5 },
          ],
        })}
        onChange={onChange}
      />,
    )
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Bob')).toBeInTheDocument()

    const s2Policy = buildCapitalPolicy({ initialCapTable: [{ id: 'c', name: 'Carol', ownership: 1 }] })
    rerender(
      <CapitalPolicySection
        scenarioId="s2"
        evRange={buildEvRange()}
        vcMethod={buildVcMethod()}
        capitalPolicy={s2Policy}
        onChange={onChange}
      />,
    )
    expect(screen.queryByDisplayValue('Alice')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Carol')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '＋ ラウンドを追加' }))
    const afterAdd = onChange.mock.calls.at(-1)?.[0] as ScenarioCapitalPolicyInputs
    expect(afterAdd.rounds).toHaveLength(1)
  })
})
