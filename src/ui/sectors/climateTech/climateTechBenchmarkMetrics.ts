/**
 * ClimateTechInputs / keyMetrics とベンチマーク metric_id の対応。
 * 出典: data/benchmarks/benchmark.schema.json (v1.1)
 *
 * "capex_intensity"(比率0.6)は算出方法がengine-spec.md上未定義(CAPEXと何を
 * 対比した比率か—売上・生産能力等—が特定できない)。UI側で独自に定義すると
 * 誤解を招く比較になりかねないため、この指標は比較対象外とする。将来、
 * engine-spec.mdでintensityの定義が確定した時点で対応する。
 */
import type { ClimateTechInputs } from '../../../engine/index.ts'
import type { BenchmarkMetricConfig } from '../../benchmarkMetricConfig.ts'

export const CLIMATE_TECH_BENCHMARK_METRICS: BenchmarkMetricConfig<ClimateTechInputs>[] = [
  {
    metricId: 'offtake_coverage',
    label: 'オフテイク契約カバー率',
    unit: 'percent',
    getValue: (inputs) => inputs.offtakeCoverage * 100,
  },
  {
    metricId: 'subsidy_dependency',
    label: '補助金依存度',
    unit: 'percent',
    getValue: (inputs) => inputs.subsidyCoverage * 100,
  },
  {
    metricId: 'scaleup_success_prob',
    label: '量産化到達確率',
    unit: 'percent',
    getValue: (inputs) => inputs.massProductionProb * 100,
  },
  {
    metricId: 'discount_rate',
    label: '割引率(ベース)',
    unit: 'percent',
    getValue: (inputs) => inputs.discountRate.base * 100,
  },
]
