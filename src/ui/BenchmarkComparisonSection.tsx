import type { BenchmarkData, BenchmarkEntry } from '../adapters/benchmarks/types.ts'
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
 * 出典行(D-13)。basis(算定基準)を併記し、notesはdetails/開閉で表示する。
 * 「取得日」(source.retrieved_at)はエントリ固有、「基準日(as_of)」はセクター単位でデータ全体が
 * 更新された時点(BenchmarkData.as_of)であり意味が異なるため、両方を明示して並記する
 * (出典: docs/phase6-spec.md §7 D-13。従来「取得日」のみの表記だったものを整理)。
 */
function BenchmarkSourceCitation({ entry, asOf, prefixLabel }: { entry: BenchmarkEntry; asOf: string; prefixLabel: string }) {
  const basisText = entry.basis ? `算定基準: ${entry.basis}・` : ''
  return (
    <div className="benchmark-comparison__source">
      <p>
        {prefixLabel} 出典: {entry.source.name}({basisText}基準日(as_of): {asOf}・取得日: {entry.source.retrieved_at})
      </p>
      {entry.notes && (
        <details className="benchmark-comparison__notes">
          <summary>備考</summary>
          <p>{entry.notes}</p>
        </details>
      )}
    </div>
  )
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
          const compEntries = entries.filter((e) => e.reference_type === 'comp_company')
          const comps = compEntries.map((c) => ({ name: c.company_name ?? '(不明)', value: c.value }))
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
                unitSuffix={metric.unitSuffix}
                direction={metric.direction}
              />
              {industryStandard && (
                <BenchmarkSourceCitation entry={industryStandard} asOf={benchmark.as_of} prefixLabel="業界標準" />
              )}
              {compEntries.map((c) => (
                <BenchmarkSourceCitation
                  key={c.company_name ?? c.source.name}
                  entry={c}
                  asOf={benchmark.as_of}
                  prefixLabel={c.company_name ?? '(不明)'}
                />
              ))}
            </div>
          )
        })
      )}
    </section>
  )
}
