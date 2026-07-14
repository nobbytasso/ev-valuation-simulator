/**
 * 資本政策・希薄化シミュレーターセクション(T4)。出典: docs/phase4-spec.md §4
 * VC法セクション(既存)とは併存し、意味の違いをキャプションで明示する(§4.3)。
 */
import { useEffect, useRef } from 'react'
import { simulateDilution, validateDilutionInputs } from '../../engine/index.ts'
import type { CapTableHolder, DilutionInputs, EvRange, FundingRound } from '../../engine/index.ts'
import type { ScenarioCapitalPolicyInputs, ScenarioVcMethodInputs } from '../../store/scenarioTypes.ts'
import { formatMoney } from '../format/money.ts'
import { useMoneyUnit } from '../format/useMoneyUnit.ts'
import { CircularGauge } from '../gauge/CircularGauge.tsx'
import { IRR_DISPLAY_MAX, MOIC_DISPLAY_MAX, normalizeRatio } from '../gauge/gaugeConstants.ts'
import { SectionHeading } from '../SectionHeading.tsx'
import { useStableListKeys } from '../useStableListKeys.ts'
import { buildOwnershipMatrix } from './ownershipMatrix.ts'
import './CapitalPolicySection.css'

export interface CapitalPolicySectionProps {
  /** scenario切替の検知用(§5.3。フックの所有コンポーネントとしてreset(...)を呼ぶ) */
  scenarioId: string
  evRange: EvRange
  vcMethod: ScenarioVcMethodInputs
  capitalPolicy: ScenarioCapitalPolicyInputs
  onChange: (next: ScenarioCapitalPolicyInputs) => void
}

const EXIT_EV_SOURCE_OPTIONS: { value: ScenarioCapitalPolicyInputs['exitEvSource']; label: string }[] = [
  { value: 'pessimistic', label: '悲観' },
  { value: 'base', label: 'ベース' },
  { value: 'optimistic', label: '楽観' },
]

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function createDefaultHolder(): CapTableHolder {
  return { id: crypto.randomUUID(), name: '', ownership: 0 }
}

function createDefaultRound(nextYear: number): FundingRound {
  return {
    name: `ラウンド${nextYear}`,
    yearIndex: nextYear,
    preMoneyValuation: 1000,
    amountRaised: 300,
    optionPoolPostPct: 0.1,
    fundInvestment: 0,
  }
}

/**
 * 資本政策(初期保有者・将来ラウンド)の入力と、シナリオ評価結果から接続したExit企業価値による
 * 希薄化シミュレーション結果(持分推移・Exit時手取り・期待IRR/MOIC)を表示する。
 */
export function CapitalPolicySection({
  scenarioId,
  evRange,
  vcMethod,
  capitalPolicy,
  onChange,
}: CapitalPolicySectionProps) {
  const { unit } = useMoneyUnit()
  const holderKeys = useStableListKeys(capitalPolicy.initialCapTable.length)
  const roundKeys = useStableListKeys(capitalPolicy.rounds.length)

  const lastSyncedId = useRef<string | null>(null)
  useEffect(() => {
    if (lastSyncedId.current !== scenarioId) {
      holderKeys.reset(capitalPolicy.initialCapTable.length)
      roundKeys.reset(capitalPolicy.rounds.length)
      lastSyncedId.current = scenarioId
    }
  }, [scenarioId, holderKeys, roundKeys, capitalPolicy.initialCapTable.length, capitalPolicy.rounds.length])

  const updateHolder = (index: number, patch: Partial<CapTableHolder>) => {
    onChange({
      ...capitalPolicy,
      initialCapTable: capitalPolicy.initialCapTable.map((h, i) => (i === index ? { ...h, ...patch } : h)),
    })
  }
  const addHolder = () => {
    onChange({ ...capitalPolicy, initialCapTable: [...capitalPolicy.initialCapTable, createDefaultHolder()] })
    holderKeys.push()
  }
  const removeHolder = (index: number) => {
    onChange({ ...capitalPolicy, initialCapTable: capitalPolicy.initialCapTable.filter((_, i) => i !== index) })
    holderKeys.removeAt(index)
  }

  const updateRound = (index: number, patch: Partial<FundingRound>) => {
    onChange({ ...capitalPolicy, rounds: capitalPolicy.rounds.map((r, i) => (i === index ? { ...r, ...patch } : r)) })
  }
  const addRound = () => {
    const nextYear = capitalPolicy.rounds.length ? Math.max(...capitalPolicy.rounds.map((r) => r.yearIndex)) + 1 : 1
    onChange({ ...capitalPolicy, rounds: [...capitalPolicy.rounds, createDefaultRound(nextYear)] })
    roundKeys.push()
  }
  const removeRound = (index: number) => {
    onChange({ ...capitalPolicy, rounds: capitalPolicy.rounds.filter((_, i) => i !== index) })
    roundKeys.removeAt(index)
  }

  const equityValue = evRange[capitalPolicy.exitEvSource] - vcMethod.netDebtAtExit
  const dilutionInputs: DilutionInputs = {
    initialCapTable: capitalPolicy.initialCapTable,
    rounds: capitalPolicy.rounds,
    exit: { yearIndex: vcMethod.yearsToExit, equityValue },
  }
  const issues = equityValue > 0 ? validateDilutionInputs(dilutionInputs) : []
  const result = equityValue > 0 && issues.length === 0 ? simulateDilution(dilutionInputs) : null

  const fundHolderIds = new Set<string>()
  for (const holder of capitalPolicy.initialCapTable) {
    if (holder.isFund) fundHolderIds.add(holder.id)
  }
  for (const snapshot of result?.rounds ?? []) {
    for (const holder of snapshot.capTableAfter) {
      if (holder.isFund) fundHolderIds.add(holder.id)
    }
  }
  const fundExitHolders = result?.exitCapTable.filter((h) => fundHolderIds.has(h.id)) ?? []
  const fundOwnershipSum = fundExitHolders.reduce((sum, h) => sum + h.effectiveOwnership, 0)
  const fundPayoutSum = fundExitHolders.reduce((sum, h) => sum + h.payout, 0)

  const matrix = result ? buildOwnershipMatrix(capitalPolicy.initialCapTable, result.rounds) : []

  return (
    <section className="capital-policy-section">
      <SectionHeading captionKey="capitalPolicy">資本政策・希薄化シミュレーター</SectionHeading>
      <p className="capital-policy-section__caption">
        VC法セクションの「目標倍率からの要求水準」は目標から逆算した値です。ここでの「期待IRR/MOIC」は、
        入力した資本政策とシナリオ評価額から順算した予測値です。
      </p>

      <label className="capital-policy-section__exit-source">
        Exit企業価値の参照レンジ点
        <select
          value={capitalPolicy.exitEvSource}
          onChange={(e) =>
            onChange({ ...capitalPolicy, exitEvSource: e.target.value as ScenarioCapitalPolicyInputs['exitEvSource'] })
          }
        >
          {EXIT_EV_SOURCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <h3>初期保有者</h3>
      <table className="capital-policy-section__table">
        <thead>
          <tr>
            <th>名前</th>
            <th>持分(%)</th>
            <th>プール</th>
            <th>自ファンド</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {capitalPolicy.initialCapTable.map((holder, i) => (
            <tr key={holderKeys.keys[i] ?? String(i)}>
              <td>
                <input
                  type="text"
                  value={holder.name}
                  onChange={(e) => updateHolder(i, { name: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="number"
                  step="1"
                  value={holder.ownership * 100}
                  onChange={(e) => updateHolder(i, { ownership: Number(e.target.value) / 100 })}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={holder.isPool ?? false}
                  onChange={(e) => updateHolder(i, { isPool: e.target.checked })}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={holder.isFund ?? false}
                  onChange={(e) => updateHolder(i, { isFund: e.target.checked })}
                />
              </td>
              <td>
                <button
                  type="button"
                  onClick={() => removeHolder(i)}
                  disabled={capitalPolicy.initialCapTable.length <= 1}
                >
                  保有者を削除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={addHolder}>
        ＋ 保有者を追加
      </button>

      <h3>将来ラウンド</h3>
      <table className="capital-policy-section__table">
        <thead>
          <tr>
            <th>ラウンド名</th>
            <th>年</th>
            <th>プレバリュー(百万円)</th>
            <th>調達額(百万円)</th>
            <th>プール目標(%)</th>
            <th>自ファンド出資額(百万円)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {capitalPolicy.rounds.map((round, i) => (
            <tr key={roundKeys.keys[i] ?? String(i)}>
              <td>
                <input type="text" value={round.name} onChange={(e) => updateRound(i, { name: e.target.value })} />
              </td>
              <td>
                <input
                  type="number"
                  step="1"
                  value={round.yearIndex}
                  onChange={(e) => updateRound(i, { yearIndex: Number(e.target.value) })}
                />
              </td>
              <td>
                <input
                  type="number"
                  step="100"
                  value={round.preMoneyValuation}
                  onChange={(e) => updateRound(i, { preMoneyValuation: Number(e.target.value) })}
                />
              </td>
              <td>
                <input
                  type="number"
                  step="10"
                  value={round.amountRaised}
                  onChange={(e) => updateRound(i, { amountRaised: Number(e.target.value) })}
                />
              </td>
              <td>
                <input
                  type="number"
                  step="1"
                  value={round.optionPoolPostPct * 100}
                  onChange={(e) => updateRound(i, { optionPoolPostPct: Number(e.target.value) / 100 })}
                />
              </td>
              <td>
                <input
                  type="number"
                  step="10"
                  value={round.fundInvestment}
                  onChange={(e) => updateRound(i, { fundInvestment: Number(e.target.value) })}
                />
              </td>
              <td>
                <button type="button" onClick={() => removeRound(i)}>
                  ラウンドを削除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={addRound}>
        ＋ ラウンドを追加
      </button>

      <h3>シミュレーション結果</h3>
      {equityValue <= 0 ? (
        <p role="alert">Exit株式価値が0以下のため手取り・IRR/MOICを計算できません。</p>
      ) : issues.length > 0 ? (
        <div role="alert">
          <h4>入力エラー</h4>
          <ul>
            {issues.map((issue) => (
              <li key={`${issue.field}-${issue.code}`}>
                {issue.field}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : result ? (
        <>
          <table className="capital-policy-section__table">
            <thead>
              <tr>
                <th>保有者</th>
                <th>初期</th>
                {capitalPolicy.rounds.map((round, i) => (
                  <th key={roundKeys.keys[i] ?? String(i)}>{round.name}後</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.values[0] === null ? '—' : formatPct(row.values[0])}</td>
                  {capitalPolicy.rounds.map((_round, i) => {
                    const value = row.values[i + 1]
                    return <td key={roundKeys.keys[i] ?? String(i)}>{value === null || value === undefined ? '—' : formatPct(value)}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <p>
            Exit時 自社(ファンド)実効持分合計: <strong>{formatPct(fundOwnershipSum)}</strong>
          </p>
          <p>
            Exit時 自社(ファンド)手取り合計: <strong>{formatMoney(fundPayoutSum, unit)}</strong>
          </p>
          <p>
            期待IRR:{' '}
            <strong>
              {result.fundIrr !== null ? (
                formatPct(result.fundIrr)
              ) : (
                <span className="status-caution">—(自ファンドの出資がありません)</span>
              )}
            </strong>
          </p>
          <p>
            期待MOIC:{' '}
            <strong>
              {result.fundMoic !== null ? (
                `${result.fundMoic.toFixed(2)}x`
              ) : (
                <span className="status-caution">—(自ファンドの出資がありません)</span>
              )}
            </strong>
          </p>
          <div className="capital-policy-section__gauges">
            {result.fundIrr !== null && (
              <CircularGauge
                label="期待IRR"
                value={result.fundIrr}
                valueText={formatPct(result.fundIrr)}
                ratio={normalizeRatio(result.fundIrr, IRR_DISPLAY_MAX)}
              />
            )}
            {result.fundMoic !== null && (
              <CircularGauge
                label="期待MOIC"
                value={result.fundMoic}
                valueText={`${result.fundMoic.toFixed(2)}x`}
                ratio={normalizeRatio(result.fundMoic, MOIC_DISPLAY_MAX)}
              />
            )}
          </div>
        </>
      ) : null}
    </section>
  )
}
