import type { BenchmarkData } from '../adapters/benchmarks/types.ts'
import { BenchmarkBar } from './BenchmarkBar.tsx'
import { DummyDataBadge } from './DummyDataBadge.tsx'
import type { BenchmarkMetricConfig } from './benchmarkMetricConfig.ts'
import './BenchmarkComparisonSection.css'

export interface BenchmarkComparisonSectionProps<TInputs> {
  benchmark: BenchmarkData | null
  metrics: BenchmarkMetricConfig<TInputs>[]
  inputs: TInputs
  /** undefinedの場合は入力エラー中として比較をスキップする */
  keyMetrics: Record<string, number> | undefined
}

/**
 * ベンチマーク比較セクション(業界標準値=基準線、比較対象企業=マーカー、ダミーバッジ)。
 * 出典: docs/requirements-rev4.md §4.1.2。全セクターで共有する。
 */
export function BenchmarkComparisonSection<TInputs>({
  benchmark,
  metrics,
  inputs,
  keyMetrics,
}: BenchmarkComparisonSectionProps<TInputs>) {
  return (
    <section>
      <h2>
        ベンチマーク比較
        {benchmark?.data_status === 'dummy' && <DummyDataBadge />}
      </h2>
      {!benchmark ? (
        <p>ベンチマークデータを読み込み中...</p>
      ) : !keyMetrics ? (
        <p>入力エラーのため比較できません。</p>
      ) : (
        metrics.map((metric) => {
          const entries = benchmark.benchmarks.filter((b) => b.metric_id === metric.metricId)
          const industryStandard = entries.find((e) => e.reference_type === 'industry_standard')
          const comps = entries
            .filter((e) => e.reference_type === 'comp_company')
            .map((c) => ({ name: c.company_name ?? '(不明)', value: c.value }))
          const currentValue = metric.getValue(inputs, keyMetrics)
          if (currentValue === undefined) return null
          return (
            <div key={metric.metricId} className="benchmark-comparison__item">
              <BenchmarkBar
                label={metric.label}
                unit={metric.unit}
                currentValue={currentValue}
                industryStandard={industryStandard?.value}
                comps={comps}
              />
              {industryStandard && (
                <p className="benchmark-comparison__source">
                  出典: {industryStandard.source.name}(取得日: {industryStandard.source.retrieved_at})
                </p>
              )}
            </div>
          )
        })
      )}
    </section>
  )
}
