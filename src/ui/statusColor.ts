/**
 * 判定色システム(段階状態色、純粋関数)。出典: docs/phase6-spec.md §5、P6-5裁定
 * 新しい閾値を発明しない — 既存の業界標準値・既存フラグのみを根拠とする(§5.1)。
 */
export type StatusColor = 'good' | 'caution' | 'bad' | 'neutral'
export type MetricDirection = 'higher_better' | 'lower_better' | 'neutral'

/** caution帯域: 業界標準比±10%以内は「標準並み」として扱う(P6-5裁定)。 */
const CAUTION_BAND_RATIO = 0.1

/**
 * ベンチマーク対比の判定色(§5.1「ベンチマーク対比」規則)。
 * direction=neutralの指標(マルチプル・割引率等)は判定しない(neutral、色を付けない)。
 * industryStandard=0は相対差が定義できないためneutralにフォールバックする。
 */
export function benchmarkStatus(currentValue: number, industryStandard: number, direction: MetricDirection): StatusColor {
  if (direction === 'neutral') return 'neutral'
  if (industryStandard === 0) return 'neutral'

  const relativeDiff = (currentValue - industryStandard) / Math.abs(industryStandard)
  if (Math.abs(relativeDiff) <= CAUTION_BAND_RATIO) return 'caution'

  const isGoodDirection = direction === 'higher_better' ? relativeDiff > 0 : relativeDiff < 0
  return isGoodDirection ? 'good' : 'bad'
}
