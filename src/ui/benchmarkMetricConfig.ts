import type { BenchmarkUnit } from '../adapters/benchmarks/types.ts'

/** セクターのInputs/keyMetricsとベンチマークmetric_idを対応づける設定。 */
export interface BenchmarkMetricConfig<TInputs> {
  metricId: string
  label: string
  unit: BenchmarkUnit
  getValue: (inputs: TInputs, keyMetrics: Record<string, number>) => number | undefined
}
