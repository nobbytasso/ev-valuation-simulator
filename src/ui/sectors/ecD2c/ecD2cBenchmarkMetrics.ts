/**
 * EcD2cInputs / keyMetrics とベンチマーク metric_id の対応。
 * 出典: data/benchmarks/benchmark.schema.json (v1.2)
 */
import type { EcD2cInputs } from '../../../engine/index.ts'
import type { BenchmarkMetricConfig } from '../../benchmarkMetricConfig.ts'

export const EC_D2C_BENCHMARK_METRICS: BenchmarkMetricConfig<EcD2cInputs>[] = [
  {
    metricId: 'revenue_growth_yoy',
    label: '売上成長率(YoY)',
    unit: 'percent',
    getValue: (inputs) => inputs.revenueGrowth * 100,
  },
  {
    metricId: 'gross_margin',
    label: '粗利率',
    unit: 'percent',
    getValue: (inputs) => inputs.grossMargin * 100,
  },
  {
    metricId: 'f2_conversion',
    label: 'F2転換率',
    unit: 'percent',
    getValue: (inputs) => inputs.f2Rate * 100,
  },
  {
    metricId: 'ltv_cac',
    label: 'LTV/CAC',
    unit: 'ratio',
    getValue: (_inputs, keyMetrics) => keyMetrics.ltvCacRatio,
  },
  {
    metricId: 'ad_cost_ratio',
    label: '売上比広告費',
    unit: 'percent',
    getValue: (inputs) => inputs.adCostRatio * 100,
  },
  {
    // ベンチマークの ev_sales_multiple は売上ベースのマルチプルのため、
    // multipleBasis = 'revenue' のときのみ比較対象とする
    metricId: 'ev_sales_multiple',
    label: 'EV/売上マルチプル(ベース)',
    unit: 'x_multiple',
    getValue: (inputs) => (inputs.multipleBasis === 'revenue' ? inputs.evMultiple.base : undefined),
  },
]
