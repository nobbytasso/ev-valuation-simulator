/**
 * 感度分析(トルネードチャート)。
 * 出典: docs/engine-spec.md §1.5
 *
 * このモジュールはセクターに依存しない汎用の骨格のみを提供する。各セクターは
 * ドライバーの値をどう変動・クランプするか(applyDriver)と、変動後の入力から
 * EV(base multiple/base割引率で評価)を1つ計算する方法(evaluate)を宣言する。
 *
 * 依存ゼロの純粋関数のみ。
 */
import type { Money, Ratio } from '../types.ts'

export interface SensitivityConfig {
  delta: Ratio // 既定 0.20(±20%)。変更可
  driverIds: string[] // 対象ドライバー(各セクターモデルが感度対象を宣言)
}

export interface TornadoItem {
  driverId: string
  evAtLow: Money // ドライバー × (1 − δ) 時のEV
  evAtHigh: Money // ドライバー × (1 + δ) 時のEV
  span: Money // |evAtHigh − evAtLow|
}

/**
 * ドライバーを乗算(相対)変動させた新しい入力を返す。定義域を出る場合は
 * 実装側で定義域端にクランプすること(→ U-15)。
 */
export type DriverApplier<TInputs> = (inputs: TInputs, driverId: string, multiplier: number) => TInputs

/** ベース倍率・ベース割引率でのEV単一値を返す評価関数。 */
export type EvEvaluator<TInputs> = (inputs: TInputs) => Money

/**
 * 変動は一度に1ドライバー(one-at-a-time)、他はベース値固定。
 * 出力: TornadoItem[] を span 降順ソート。
 */
export function buildTornado<TInputs>(
  baseInputs: TInputs,
  config: SensitivityConfig,
  applyDriver: DriverApplier<TInputs>,
  evaluate: EvEvaluator<TInputs>,
): TornadoItem[] {
  const items: TornadoItem[] = config.driverIds.map((driverId) => {
    const lowInputs = applyDriver(baseInputs, driverId, 1 - config.delta)
    const highInputs = applyDriver(baseInputs, driverId, 1 + config.delta)
    const evAtLow = evaluate(lowInputs)
    const evAtHigh = evaluate(highInputs)
    return { driverId, evAtLow, evAtHigh, span: Math.abs(evAtHigh - evAtLow) }
  })
  return items.sort((a, b) => b.span - a.span)
}
