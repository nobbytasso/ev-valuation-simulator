/**
 * SaasInputs / keyMetrics とベンチマーク metric_id の対応。
 * 出典: data/benchmarks/benchmark.schema.json (v1.2)
 */
import type { SaasInputs } from '../../../engine/index.ts'
import type { BenchmarkMetricConfig } from '../../benchmarkMetricConfig.ts'

export const SAAS_BENCHMARK_METRICS: BenchmarkMetricConfig<SaasInputs>[] = [
  {
    metricId: 'arr_growth_yoy',
    label: 'ARR成長率(YoY)',
    unit: 'percent',
    getValue: (inputs) => inputs.arrGrowth * 100,
    direction: 'higher_better',
  },
  {
    metricId: 'nrr',
    label: 'NRR',
    unit: 'percent',
    getValue: (inputs) => inputs.nrr * 100,
    direction: 'higher_better',
  },
  {
    metricId: 'gross_margin',
    label: 'グロスマージン',
    unit: 'percent',
    getValue: (inputs) => inputs.grossMargin * 100,
    direction: 'higher_better',
  },
  {
    metricId: 'operating_margin',
    label: '営業利益率',
    unit: 'percent',
    getValue: (inputs) => inputs.operatingMargin * 100,
    direction: 'higher_better',
  },
  {
    metricId: 'rule_of_40',
    label: 'Rule of 40',
    unit: 'percent',
    getValue: (_inputs, keyMetrics) => keyMetrics.ruleOf40,
    direction: 'higher_better',
  },
  {
    metricId: 'ev_arr_multiple',
    label: 'EV/ARRマルチプル(ベース)',
    unit: 'x_multiple',
    getValue: (inputs) => inputs.evArrMultiple.base,
    direction: 'neutral',
  },
]
