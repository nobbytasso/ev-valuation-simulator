/**
 * MedicalDeviceInputs / keyMetrics とベンチマーク metric_id の対応。
 * 出典: data/benchmarks/benchmark.schema.json (v1.1)
 *
 * "ev_sales_multiple" は比較対象外とする。評価モデルが市場浸透+DCF主体で
 * マルチプル指標を持たないため(engine-spec.md §2.3「EV/売上は参考値として
 * 併記可」)、UI側で売上を再計算してまで近似値を出すのはエンジンとの二重実装に
 * なり避けたい。将来、実装ロジック側にimplied multipleを追加した際に対応する。
 */
import { penetrationAtYear } from '../../../engine/index.ts'
import type { MedicalDeviceInputs } from '../../../engine/index.ts'
import type { BenchmarkMetricConfig } from '../../benchmarkMetricConfig.ts'

export const MEDICAL_DEVICE_BENCHMARK_METRICS: BenchmarkMetricConfig<MedicalDeviceInputs>[] = [
  {
    // Class III向け業界標準のため、Class III以外のデバイスでは比較対象外とする。
    // 比較値は実効上市までの年数 launchYear + approvalDelayYears(Rev.5 §6.1、C-4裁定)。
    // 承認遅延シナリオのレバーがベンチマーク比較にも反映される。
    metricId: 'approval_lead_time_class3',
    label: '実効上市までの年数(承認+償還)',
    unit: 'years',
    getValue: (inputs) => (inputs.deviceClass === 'III' ? inputs.launchYear + inputs.approvalDelayYears : undefined),
  },
  {
    // penetration_5y = Pen(実効上市年+4)。エンジンのPen(t)式をpenetrationAtYear()経由で
    // 直接呼び出す(D-9/B-3: UI側での式複製を廃止)。
    metricId: 'penetration_5y',
    label: '上市5年目の浸透率',
    unit: 'percent',
    getValue: (inputs) => penetrationAtYear(inputs, inputs.launchYear + inputs.approvalDelayYears + 4) * 100,
  },
  {
    metricId: 'recurring_revenue_ratio',
    label: 'リカーリング比率',
    unit: 'percent',
    getValue: (inputs) => inputs.recurringRatio * 100,
  },
]
