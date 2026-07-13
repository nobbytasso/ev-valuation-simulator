/**
 * SaasInputs / keyMetrics とベンチマーク metric_id の対応。
 * 出典: data/benchmarks/benchmark.schema.json (v1.1)
 */
import type { SaasInputs } from '../../../engine/index.ts'
import type { BenchmarkUnit } from '../../../adapters/benchmarks/types.ts'

export interface SaasBenchmarkMetricConfig {
  metricId: string
  label: string
  unit: BenchmarkUnit
  getValue: (inputs: SaasInputs, keyMetrics: Record<string, number>) => number | undefined
}

export const SAAS_BENCHMARK_METRICS: SaasBenchmarkMetricConfig[] = [
  {
    metricId: 'arr_growth_yoy',
    label: 'ARR成長率(YoY)',
    unit: 'percent',
    getValue: (inputs) => inputs.arrGrowth * 100,
  },
  {
    metricId: 'nrr',
    label: 'NRR',
    unit: 'percent',
    getValue: (inputs) => inputs.nrr * 100,
  },
  {
    metricId: 'gross_margin',
    label: 'グロスマージン',
    unit: 'percent',
    getValue: (inputs) => inputs.grossMargin * 100,
  },
  {
    metricId: 'operating_margin',
    label: '営業利益率',
    unit: 'percent',
    getValue: (inputs) => inputs.operatingMargin * 100,
  },
  {
    metricId: 'rule_of_40',
    label: 'Rule of 40',
    unit: 'percent',
    getValue: (_inputs, keyMetrics) => keyMetrics.ruleOf40,
  },
  {
    metricId: 'ev_arr_multiple',
    label: 'EV/ARRマルチプル(ベース)',
    unit: 'x_multiple',
    getValue: (inputs) => inputs.evArrMultiple.base,
  },
]
