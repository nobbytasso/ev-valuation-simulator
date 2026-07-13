import type { ReactNode } from 'react'
import type { EngineResult, SectorValuationResult } from '../engine/index.ts'

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
            <td>企業価値(百万円)</td>
            <td>{result.value.ev.pessimistic.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}</td>
            <td>{result.value.ev.base.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}</td>
            <td>{result.value.ev.optimistic.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}</td>
          </tr>
        </tbody>
      </table>
      {result.value.auxiliary !== undefined && (
        <p>補助評価値(簡易DCF): {result.value.auxiliary.toLocaleString('ja-JP', { maximumFractionDigits: 0 })} 百万円</p>
      )}
      {children}
    </div>
  )
}
