import type { ReactNode } from 'react'
import type { EngineResult, SectorValuationResult } from '../engine/index.ts'
import { formatMoney, formatMoneyValue, moneyAxisLabel } from './format/money.ts'
import { useMoneyUnit } from './format/useMoneyUnit.ts'
import { CircularGauge } from './gauge/CircularGauge.tsx'

export interface EvRangeResultProps {
  result: EngineResult<SectorValuationResult>
  /** セクター固有の追加指標(例: SaaSのRule of 40)をEVレンジ表の下に差し込む */
  children?: ReactNode
}

/**
 * 企業価値レンジ(悲観/ベース/楽観)+ 補助評価値の共通表示。ok: false の場合はバリデーション
 * エラー一覧を表示する。全セクター結果ビューで共有(出典: docs/requirements-rev4.md §4.1.2)。
 */
export function EvRangeResult({ result, children }: EvRangeResultProps) {
  const { unit } = useMoneyUnit()
  if (!result.ok) {
    return (
      <div role="alert">
        <h3>入力エラー</h3>
        <ul>
          {result.errors.map((err) => (
            <li key={err.code}>
              {err.field}: {err.message}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const { pessimistic, base, optimistic } = result.value.ev
  const evSpan = optimistic - pessimistic
  const evRatio = evSpan > 0 ? (base - pessimistic) / evSpan : null

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>悲観</th>
            <th>ベース</th>
            <th>楽観</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>企業価値{moneyAxisLabel(unit)}</td>
            <td>{formatMoneyValue(result.value.ev.pessimistic, unit)}</td>
            <td>{formatMoneyValue(result.value.ev.base, unit)}</td>
            <td>{formatMoneyValue(result.value.ev.optimistic, unit)}</td>
          </tr>
        </tbody>
      </table>
      <CircularGauge
        label="企業価値(ベース)"
        value={base}
        valueText={formatMoney(base, unit)}
        ratio={evRatio}
        status={base <= 0 ? 'bad' : 'neutral'}
      />
      {result.value.auxiliary !== undefined && <p>補助評価値(簡易DCF): {formatMoney(result.value.auxiliary, unit)}</p>}
      {result.value.ev.base <= 0 && (
        <p role="alert" className="status-bad">
          企業価値(ベース)が0以下です。投資判断に用いる際は前提条件を再確認してください。
        </p>
      )}
      {children}
    </div>
  )
}
