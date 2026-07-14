import type { BenchmarkUnit } from '../adapters/benchmarks/types.ts'
import type { MetricDirection } from './statusColor.ts'

/** セクターのInputs/keyMetricsとベンチマークmetric_idを対応づける設定。 */
export interface BenchmarkMetricConfig<TInputs> {
  metricId: string
  label: string
  unit: BenchmarkUnit
  getValue: (inputs: TInputs, keyMetrics: Record<string, number>) => number | undefined
  /** unit派生の既定サフィックスを上書きする(D-14。個別の単位語が必要な場合のみ指定)。 */
  unitSuffix?: string
  /** 判定色(§5)の極性。P6-5裁定の全25 metric確定表(docs/phase6-spec.md §5.2)以外を発明しない。 */
  direction: MetricDirection
}
