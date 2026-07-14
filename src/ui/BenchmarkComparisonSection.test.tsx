// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { BenchmarkData } from '../adapters/benchmarks/types.ts'
import { BenchmarkComparisonSection } from './BenchmarkComparisonSection.tsx'
import type { BenchmarkMetricConfig } from './benchmarkMetricConfig.ts'

afterEach(() => {
  cleanup()
})

interface DummyInputs {
  value: number
}

const metrics: BenchmarkMetricConfig<DummyInputs>[] = [
  { metricId: 'sample_metric', label: 'サンプル指標', unit: 'percent', getValue: (i) => i.value, direction: 'higher_better' },
]

function buildBenchmark(): BenchmarkData {
  return {
    schema_version: '1.2',
    sector: 'saas_jp',
    sector_label_ja: 'SaaS',
    data_status: 'dummy',
    as_of: '2026-07-13',
    benchmarks: [
      {
        metric_id: 'sample_metric',
        label_ja: 'サンプル指標',
        unit: 'percent',
        reference_type: 'industry_standard',
        company_name: null,
        value: 30,
        source: { name: 'DUMMY業界レポート', url: null, retrieved_at: '2026-07-01' },
      },
      {
        metric_id: 'sample_metric',
        label_ja: 'サンプル指標',
        unit: 'percent',
        reference_type: 'comp_company',
        company_name: 'ダミーA社',
        value: 35,
        source: { name: 'DUMMY-A開示資料', url: null, retrieved_at: '2026-07-05' },
      },
      {
        metric_id: 'sample_metric',
        label_ja: 'サンプル指標',
        unit: 'percent',
        reference_type: 'comp_company',
        company_name: 'ダミーB社',
        value: 40,
        source: { name: 'DUMMY-B開示資料', url: null, retrieved_at: '2026-07-06' },
      },
    ],
  }
}

describe('BenchmarkComparisonSection', () => {
  it('業界標準・全comp企業の出典と取得日を表示する(§4.1.2「全基準値に出典・取得日を表示」)', () => {
    render(
      <BenchmarkComparisonSection
        benchmark={buildBenchmark()}
        metrics={metrics}
        inputs={{ value: 32 }}
        keyMetrics={{}}
      />,
    )
    expect(screen.getByText(/業界標準 出典: DUMMY業界レポート/)).toHaveTextContent('取得日: 2026-07-01')
    expect(screen.getByText(/ダミーA社 出典: DUMMY-A開示資料/)).toHaveTextContent('取得日: 2026-07-05')
    expect(screen.getByText(/ダミーB社 出典: DUMMY-B開示資料/)).toHaveTextContent('取得日: 2026-07-06')
  })

  it('基準日(as_of)を各出典行に併記する(D-13)', () => {
    render(
      <BenchmarkComparisonSection
        benchmark={buildBenchmark()}
        metrics={metrics}
        inputs={{ value: 32 }}
        keyMetrics={{}}
      />,
    )
    expect(screen.getByText(/業界標準 出典: DUMMY業界レポート/)).toHaveTextContent('基準日(as_of): 2026-07-13')
  })

  it('basisがある場合は算定基準を出典行に併記する(D-13)', () => {
    const benchmark = buildBenchmark()
    benchmark.benchmarks[0].basis = 'ARR成長率、直近12ヶ月'
    render(
      <BenchmarkComparisonSection
        benchmark={benchmark}
        metrics={metrics}
        inputs={{ value: 32 }}
        keyMetrics={{}}
      />,
    )
    expect(screen.getByText(/業界標準 出典: DUMMY業界レポート/)).toHaveTextContent('算定基準: ARR成長率、直近12ヶ月')
  })

  it('notesがある場合はdetails(開閉)で備考を表示する(D-13)', () => {
    const benchmark = buildBenchmark()
    benchmark.benchmarks[0].notes = '外れ値を除外した中央値'
    render(
      <BenchmarkComparisonSection
        benchmark={benchmark}
        metrics={metrics}
        inputs={{ value: 32 }}
        keyMetrics={{}}
      />,
    )
    expect(screen.getByText('備考')).toBeInTheDocument()
    expect(screen.getByText('外れ値を除外した中央値')).toBeInTheDocument()
    expect(screen.getByText('備考').closest('details')).not.toHaveAttribute('open')
  })

  it('notesがない場合はdetailsを描画しない(D-13)', () => {
    render(
      <BenchmarkComparisonSection
        benchmark={buildBenchmark()}
        metrics={metrics}
        inputs={{ value: 32 }}
        keyMetrics={{}}
      />,
    )
    expect(screen.queryByText('備考')).not.toBeInTheDocument()
  })
})
