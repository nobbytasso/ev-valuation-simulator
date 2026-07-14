/**
 * DrugDiscoveryInputs / keyMetrics とベンチマーク metric_id の対応。
 * 出典: data/benchmarks/benchmark.schema.json (v1.2)
 *
 * ベンチマークは「1品目」単位の指標(フェーズ別成功確率・ロイヤリティ率等)だが、
 * シナリオはパイプライン(複数品目)を持ちうる。Phase 3時点では先頭の品目
 * (assets[0])のみを比較対象とする(複数品目の内訳比較はPhase 6以降で検討)。
 *
 * "pos_p3_to_approval"(Phase3完了→承認)は、本モデルではPhase3成功確率と
 * filing成功確率の2段階に分解しているため、両者の積で比較する。
 *
 * "pipeline_value_ratio"(比較対象企業のみ)は、rNPVベースのEVと何らかの
 * 基準値(ピーク売上等)の比率と推定されるが、算出方法が仕様上未確定のため
 * 比較対象外とする(→ 将来のengine-spec.md改訂で定義した際に対応)。
 */
import type { DrugDiscoveryInputs } from '../../../engine/index.ts'
import type { BenchmarkMetricConfig } from '../../benchmarkMetricConfig.ts'

export const DRUG_DISCOVERY_BENCHMARK_METRICS: BenchmarkMetricConfig<DrugDiscoveryInputs>[] = [
  {
    metricId: 'pos_preclinical_to_p1',
    label: '非臨床→P1成功確率(先頭品目)',
    unit: 'percent',
    getValue: (inputs) => inputs.assets[0]?.phaseSuccessProbs.preclinical * 100,
    direction: 'higher_better',
  },
  {
    metricId: 'pos_p1_to_p2',
    label: 'P1→P2成功確率(先頭品目)',
    unit: 'percent',
    getValue: (inputs) => inputs.assets[0]?.phaseSuccessProbs.phase1 * 100,
    direction: 'higher_better',
  },
  {
    metricId: 'pos_p2_to_p3',
    label: 'P2→P3成功確率(先頭品目)',
    unit: 'percent',
    getValue: (inputs) => inputs.assets[0]?.phaseSuccessProbs.phase2 * 100,
    direction: 'higher_better',
  },
  {
    metricId: 'pos_p3_to_approval',
    label: 'P3→承認成功確率(先頭品目)',
    unit: 'percent',
    getValue: (inputs) => {
      const asset = inputs.assets[0]
      if (!asset) return undefined
      return asset.phaseSuccessProbs.phase3 * asset.phaseSuccessProbs.filing * 100
    },
    direction: 'higher_better',
  },
  {
    metricId: 'royalty_rate',
    label: 'ロイヤリティ率(先頭品目、導出時のみ)',
    unit: 'percent',
    getValue: (inputs) => {
      const commercialization = inputs.assets[0]?.commercialization
      return commercialization?.type === 'license' ? commercialization.royaltyRate * 100 : undefined
    },
    direction: 'higher_better',
  },
  {
    metricId: 'discount_rate',
    label: '割引率(ベース)',
    unit: 'percent',
    getValue: (inputs) => inputs.discountRate.base * 100,
    direction: 'neutral',
  },
]
