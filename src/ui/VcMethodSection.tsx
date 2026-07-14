import { computeVcMethod } from '../engine/index.ts'
import type { EvRange } from '../engine/index.ts'
import type { ScenarioVcMethodInputs } from '../store/scenarioTypes.ts'
import { formatMoney } from './format/money.ts'
import { useMoneyUnit } from './format/useMoneyUnit.ts'
import { CircularGauge } from './gauge/CircularGauge.tsx'
import { IRR_DISPLAY_MAX, normalizeRatio } from './gauge/gaugeConstants.ts'
import { SectionHeading } from './SectionHeading.tsx'
import './VcMethodSection.css'

const RANGE_KEYS = ['pessimistic', 'base', 'optimistic'] as const
const RANGE_LABELS: Record<(typeof RANGE_KEYS)[number], string> = {
  pessimistic: '悲観',
  base: 'ベース',
  optimistic: '楽観',
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export interface VcMethodSectionProps {
  evRange: EvRange
  vcMethod: ScenarioVcMethodInputs
  onChange: (next: ScenarioVcMethodInputs) => void
}

/**
 * VC法(共通オーバーレイ)。出典: docs/engine-spec.md §1.2、docs/requirements-rev4.md §3共通オーバーレイ
 * Exit企業価値レンジの各点(悲観/ベース/楽観)に対して現在の許容ポストマネー・必要持分を算出し、
 * 目標倍率が含意するIRRを示す。
 */
export function VcMethodSection({ evRange, vcMethod, onChange }: VcMethodSectionProps) {
  const { unit } = useMoneyUnit()
  const results = RANGE_KEYS.map((key) =>
    computeVcMethod({
      exitEnterpriseValue: evRange[key],
      netDebtAtExit: vcMethod.netDebtAtExit,
      targetMultiple: vcMethod.targetMultiple,
      yearsToExit: vcMethod.yearsToExit,
      investment: vcMethod.investment,
      dilutionRetention: vcMethod.dilutionRetention,
    }),
  )
  const impliedIrr = results[0].impliedIrr

  const update = (patch: Partial<ScenarioVcMethodInputs>) => onChange({ ...vcMethod, ...patch })

  return (
    <section className="vc-method">
      <SectionHeading captionKey="vcMethod">VC法 / IRR・MOIC</SectionHeading>
      <div className="vc-method__inputs">
        <label>
          目標倍率(MOIC)
          <input
            type="number"
            step="0.1"
            value={vcMethod.targetMultiple}
            onChange={(e) => update({ targetMultiple: Number(e.target.value) })}
          />
        </label>
        <label>
          Exitまでの年数
          <input
            type="number"
            step="1"
            value={vcMethod.yearsToExit}
            onChange={(e) => update({ yearsToExit: Number(e.target.value) })}
          />
        </label>
        <label>
          投資額(百万円)
          <input
            type="number"
            step="10"
            value={vcMethod.investment}
            onChange={(e) => update({ investment: Number(e.target.value) })}
          />
        </label>
        <label>
          Exit時持分残存率(%)
          <input
            type="number"
            step="1"
            value={vcMethod.dilutionRetention * 100}
            onChange={(e) => update({ dilutionRetention: Number(e.target.value) / 100 })}
          />
        </label>
        <label>
          Exit時純有利子負債(百万円)
          <input
            type="number"
            step="10"
            value={vcMethod.netDebtAtExit}
            onChange={(e) => update({ netDebtAtExit: Number(e.target.value) })}
          />
        </label>
      </div>

      <p className="vc-method__implied-irr">
        目標倍率 {vcMethod.targetMultiple.toFixed(1)}x が含意するIRR: <strong>{formatPct(impliedIrr)}</strong>
      </p>
      <CircularGauge
        label="含意IRR"
        value={impliedIrr}
        valueText={formatPct(impliedIrr)}
        ratio={normalizeRatio(impliedIrr, IRR_DISPLAY_MAX)}
        status={results[0].isInfeasible ? 'bad' : 'neutral'}
      />

      <table>
        <thead>
          <tr>
            <th></th>
            {RANGE_KEYS.map((key) => (
              <th key={key}>{RANGE_LABELS[key]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Exit株式価値</td>
            {results.map((r, i) => (
              <td key={RANGE_KEYS[i]}>{formatMoney(r.exitEquityValue, unit)}</td>
            ))}
          </tr>
          <tr>
            <td>現在の許容ポストマネー</td>
            {results.map((r, i) => (
              <td key={RANGE_KEYS[i]}>{formatMoney(r.impliedPostMoneyNow, unit)}</td>
            ))}
          </tr>
          <tr>
            <td>Exit時必要持分</td>
            {results.map((r, i) => (
              <td key={RANGE_KEYS[i]}>{formatPct(r.requiredOwnershipAtExit)}</td>
            ))}
          </tr>
          <tr>
            <td>投資時必要持分</td>
            {results.map((r, i) => (
              <td key={RANGE_KEYS[i]}>
                {formatPct(r.requiredOwnershipAtEntry)}
                {r.isInfeasible && <span className="vc-method__infeasible">成立不可</span>}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </section>
  )
}
