import type { BenchmarkUnit } from '../adapters/benchmarks/types.ts'

/** セクターのInputs/keyMetricsとベンチマークmetric_idを対応づける設定。 */
export interface BenchmarkMetricConfig<TInputs> {
  metricId: string
  label: string
  unit: BenchmarkUnit
  getValue: (inputs: TInputs, keyMetrics: Record<string, number>) => number | undefined
  /** unit派生の既定サフィックスを上書きする(D-14。個別の単位語が必要な場合のみ指定)。 */
  unitSuffix?: string
}
