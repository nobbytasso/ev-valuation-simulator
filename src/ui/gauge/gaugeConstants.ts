/**
 * 円形ゲージのratio正規化定数(§4.2)。表示上の正規化のみであり評価判定ではない
 * (判定色は別途statusプロップで受け取る、docs/phase6-spec.md §4.2)。
 * マジックナンバーとして本モジュールに集約し、根拠をコメントで明示する。
 */

/** Rule of 40の表示上限。業界慣行の目安値(40pt)の2倍を満タンとし、40が中央よりやや手前に来るようにする。 */
export const RULE_OF_40_DISPLAY_MAX = 80

/** Rule of 40の業界標準ライン(リング上のマーカー位置)。 */
export const RULE_OF_40_INDUSTRY_STANDARD = 40

/** IRR系ゲージの表示上限。100%を満タンとする(意味付けではなく表示上の正規化)。 */
export const IRR_DISPLAY_MAX = 1.0

/** MOICゲージの表示上限。目標倍率10xを満タンの基準とする。 */
export const MOIC_DISPLAY_MAX = 10

/** 値を[0,1]のratioに正規化する(上限超過はクランプ)。 */
export function normalizeRatio(value: number, max: number): number {
  return Math.min(Math.max(value / max, 0), 1)
}
