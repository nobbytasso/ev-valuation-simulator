/**
 * keyMetrics表示値のフォーマット(純粋関数)。出典: docs/phase6-spec.md §7 B-2
 * Excel側(buildScenarioWorkbook.ts)の単位表記(pt/x/月/年/円/%)と揃える。
 */
import type { KeyMetricFormat } from './keyMetricsLabels.ts'

export function formatKeyMetricValue(value: number, format: KeyMetricFormat): string {
  if (format === 'pt') return `${value.toFixed(1)} pt`
  if (format === 'x') return `${value.toFixed(2)}x`
  if (format === 'months') return `${value.toFixed(1)}月`
  if (format === 'years') return `${value.toFixed(1)}年`
  if (format === 'yen') return `${value.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}円`
  return `${(value * 100).toFixed(1)}%` // ratio
}
