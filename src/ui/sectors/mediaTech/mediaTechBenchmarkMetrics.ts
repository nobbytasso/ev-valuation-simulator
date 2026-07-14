/**
 * MediaTechInputs / keyMetrics とベンチマーク metric_id の対応。
 * 出典: data/benchmarks/benchmark.schema.json (v1.2)
 *
 * "paid_conversion"(課金転換率)はMediaTechInputsに対応するドライバーが無い
 * (ブレンドARPUのみを扱うモデルのため、課金ユーザー比率という概念を持たない)。
 * 将来ドライバーを追加するまで比較対象から除外する。
 */
import { retentionAfterMonths } from '../../../engine/index.ts'
import type { MediaTechInputs } from '../../../engine/index.ts'
import type { BenchmarkMetricConfig } from '../../benchmarkMetricConfig.ts'

export const MEDIA_TECH_BENCHMARK_METRICS: BenchmarkMetricConfig<MediaTechInputs>[] = [
  {
    metricId: 'arpu_monthly_jpy',
    label: '月次ARPU',
    unit: 'jpy', // v1.2: 円建て単価はjpy(従来はcountで代用していた)
    getValue: (inputs) => inputs.arpuMonthly.ad + inputs.arpuMonthly.paid + inputs.arpuMonthly.commerce,
    direction: 'higher_better',
  },
  {
    // (1-monthlyChurn)^12。エンジンのretentionAfterMonths()経由(D-9/B-3: UI側での式複製を廃止)。
    metricId: 'm12_retention',
    label: '12ヶ月継続率',
    unit: 'percent',
    getValue: (inputs) => retentionAfterMonths(inputs.monthlyChurn, 12) * 100,
    direction: 'higher_better',
  },
  {
    metricId: 'ev_sales_multiple',
    label: 'EV/売上マルチプル(ベース)',
    unit: 'x_multiple',
    getValue: (inputs) => inputs.evSalesMultiple.base,
    direction: 'neutral',
  },
]
