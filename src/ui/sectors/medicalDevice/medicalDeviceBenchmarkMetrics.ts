/**
 * MedicalDeviceInputs / keyMetrics とベンチマーク metric_id の対応。
 * 出典: data/benchmarks/benchmark.schema.json (v1.1)
 *
 * "ev_sales_multiple" は比較対象外とする。評価モデルが市場浸透+DCF主体で
 * マルチプル指標を持たないため(engine-spec.md §2.3「EV/売上は参考値として
 * 併記可」)、UI側で売上を再計算してまで近似値を出すのはエンジンとの二重実装に
 * なり避けたい。将来、実装ロジック側にimplied multipleを追加した際に対応する。
 */
import type { MedicalDeviceInputs } from '../../../engine/index.ts'
import type { BenchmarkMetricConfig } from '../../benchmarkMetricConfig.ts'

export const MEDICAL_DEVICE_BENCHMARK_METRICS: BenchmarkMetricConfig<MedicalDeviceInputs>[] = [
  {
    // Class III向け業界標準のため、Class III以外のデバイスでは比較対象外とする
    metricId: 'approval_lead_time_class3',
    label: '承認までの想定期間(年)',
    unit: 'years',
    getValue: (inputs) => (inputs.deviceClass === 'III' ? inputs.launchYear : undefined),
  },
  {
    metricId: 'penetration_5y',
    label: '上市5年目の浸透率',
    unit: 'percent',
    getValue: (inputs) => {
      const u = 4 // 上市から5年目(u=0が1年目)
      const penetration = Math.min(inputs.peakPenetration, (inputs.peakPenetration * (u + 1)) / inputs.yearsToPeak)
      return penetration * 100
    },
  },
  {
    metricId: 'recurring_revenue_ratio',
    label: 'リカーリング比率',
    unit: 'percent',
    getValue: (inputs) => inputs.recurringRatio * 100,
  },
]
