/**
 * トルネードチャートセクション(T3)。出典: docs/phase4-spec.md §3
 * 見た目・演出はPhase 6スコープ。ここではテーマトークン参照の素朴な描画に留める。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import type { Scenario, SectorId } from '../../store/scenarioTypes.ts'
import { buildTornadoRows } from './sensitivityRegistry.ts'
import './SensitivitySection.css'

const DEFAULT_DELTA_PCT = 20
const TOP_N = 10
// span がこれ以下は「感度なし」として扱う(浮動小数点誤差の許容、§3.4)。
const NEGLIGIBLE_SPAN = 1e-6

/** base EVに無関係なユニットエコノミクス系ドライバーを削除した旨の注記対象(P4-1追加指示)。 */
const UNIT_ECONOMICS_NOTE_SECTORS: readonly SectorId[] = ['saas_jp', 'media_tech', 'ec_d2c']

export interface SensitivitySectionProps {
  /** draft入力差し替え済みのScenario(保存前の変更を即座に反映する) */
  scenario: Scenario
}

function formatMoney(value: number): string {
  return `${value.toLocaleString('ja-JP', { maximumFractionDigits: 0 })} 百万円`
}

/** 感度分析セクション。Recharts横棒(基準EVからの2セグメント)+ 変動幅設定UI。 */
export function SensitivitySection({ scenario }: SensitivitySectionProps) {
  const [defaultDeltaPct, setDefaultDeltaPct] = useState(DEFAULT_DELTA_PCT)
  const [deltaPctByDriverId, setDeltaPctByDriverId] = useState<Record<string, number>>({})
  const [showAll, setShowAll] = useState(false)

  // P4-2: 非永続(セッション内state)。シナリオ切替時は既定に戻す。
  const lastSyncedId = useRef<string | null>(null)
  useEffect(() => {
    if (lastSyncedId.current !== scenario.id) {
      setDefaultDeltaPct(DEFAULT_DELTA_PCT)
      setDeltaPctByDriverId({})
      setShowAll(false)
      lastSyncedId.current = scenario.id
    }
  }, [scenario.id])

  const { baseEv, rows } = useMemo(() => {
    const deltaByDriverId = Object.fromEntries(Object.entries(deltaPctByDriverId).map(([id, pct]) => [id, pct / 100]))
    return buildTornadoRows(scenario, { defaultDelta: defaultDeltaPct / 100, deltaByDriverId })
  }, [scenario, defaultDeltaPct, deltaPctByDriverId])

  const showUnitEconomicsNote = UNIT_ECONOMICS_NOTE_SECTORS.includes(scenario.sector)

  if (!Number.isFinite(baseEv)) {
    return (
      <section className="sensitivity-section">
        <h2>感度分析(トルネードチャート)</h2>
        <p role="alert">入力エラーのため感度分析を実行できません。</p>
      </section>
    )
  }

  const meaningfulRows = rows.filter((row) => row.span > NEGLIGIBLE_SPAN)
  const negligibleRows = rows.filter((row) => row.span <= NEGLIGIBLE_SPAN)
  const visibleRows = showAll ? meaningfulRows : meaningfulRows.slice(0, TOP_N)
  const hiddenCount = meaningfulRows.length - visibleRows.length

  const chartData = visibleRows.map((row) => ({
    label: row.label,
    low: row.evAtLow - baseEv,
    high: row.evAtHigh - baseEv,
  }))

  const updateDeltaPct = (driverId: string, pct: number) => {
    setDeltaPctByDriverId((prev) => ({ ...prev, [driverId]: pct }))
  }

  return (
    <section className="sensitivity-section">
      <h2>感度分析(トルネードチャート)</h2>
      {showUnitEconomicsNote && (
        <p className="sensitivity-section__note">
          マルチプル法のため、ユニットエコノミクス系ドライバー(解約率・CPA・F2転換率等)はEVに影響せず、感度対象外です。
        </p>
      )}

      <label className="sensitivity-section__default-delta">
        既定変動幅(個別設定のないドライバーに適用、%)
        <input
          type="number"
          step="1"
          min="0"
          value={defaultDeltaPct}
          onChange={(e) => setDefaultDeltaPct(Number(e.target.value))}
        />
      </label>

      {visibleRows.length === 0 ? (
        <p>感度のあるドライバーがありません。</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={Math.max(visibleRows.length * 32, 64)}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
              <XAxis type="number" tickFormatter={(v: number) => formatMoney(v + baseEv)} />
              <YAxis type="category" dataKey="label" width={180} />
              <ReferenceLine x={0} stroke="var(--color-accent)" strokeWidth={2} />
              <Bar dataKey="low" stackId="tornado" fill="var(--color-warning)" barSize={14} />
              <Bar dataKey="high" stackId="tornado" fill="var(--color-accent)" barSize={14} />
            </BarChart>
          </ResponsiveContainer>

          <table className="sensitivity-section__table">
            <thead>
              <tr>
                <th>ドライバー</th>
                <th>低位</th>
                <th>高位</th>
                <th>span</th>
                <th>変動幅</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.driverId}>
                  <td>{row.label}</td>
                  <td>{formatMoney(row.evAtLow)}</td>
                  <td>{formatMoney(row.evAtHigh)}</td>
                  <td>{formatMoney(row.span)}</td>
                  <td>
                    {row.isFixedDelta ? (
                      '±2pt(固定)'
                    ) : (
                      <>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={deltaPctByDriverId[row.driverId] ?? defaultDeltaPct}
                          onChange={(e) => updateDeltaPct(row.driverId, Number(e.target.value))}
                        />
                        %
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {hiddenCount > 0 && (
            <button type="button" onClick={() => setShowAll(true)}>
              残り{hiddenCount}件を表示
            </button>
          )}
        </>
      )}

      {negligibleRows.length > 0 && (
        <div className="sensitivity-section__negligible">
          <p>この変動幅では感度なし:</p>
          <ul>
            {negligibleRows.map((row) => (
              <li key={row.driverId}>{row.label}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
