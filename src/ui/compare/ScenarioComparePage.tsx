import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { StaticJsonSource } from '../../adapters/benchmarks/StaticJsonSource.ts'
import type { DataStatus } from '../../adapters/benchmarks/types.ts'
import { useScenarioStore } from '../../store/scenarioStore.ts'
import { SECTOR_LABELS } from '../../store/scenarioTypes.ts'
import type { SectorId } from '../../store/scenarioTypes.ts'
import { buildCompareWorkbook } from '../excel/buildCompareWorkbook.ts'
import { downloadXlsxFile } from '../excel/downloadXlsxFile.ts'
import type { FieldFormat } from '../scenarioEvaluation/fieldLabelTypes.ts'
import { buildCompareColumns, buildEvChartData, buildSectorBlocks, impliedIrrFor } from './compareEngine.ts'
import type { CompareColumn } from './compareEngine.ts'
import { EvRangeChart } from './EvRangeChart.tsx'
import './ScenarioComparePage.css'

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${value.toLocaleString('ja-JP', { maximumFractionDigits: 0 })} 百万円`
}
function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${(value * 100).toFixed(1)}%`
}
function formatByField(value: number | null, format: FieldFormat, unit: string): string {
  if (value === null) return '—'
  if (format === 'money') return `${value.toLocaleString('ja-JP', { maximumFractionDigits: 0 })} 百万円`
  if (format === 'yen') return `${value.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}円`
  if (format === 'ratio') return `${(value * 100).toFixed(1)}%`
  return unit ? `${value.toLocaleString('ja-JP', { maximumFractionDigits: 2 })}${unit}` : value.toLocaleString('ja-JP', { maximumFractionDigits: 2 })
}

function columnHeader(col: CompareColumn): string {
  return col.found && col.scenario ? col.scenario.name : '見つかりません'
}

function expectedReturnText(value: number | null | undefined, reason: string | null | undefined, kind: 'pct' | 'x'): string {
  if (value === null || value === undefined) {
    return reason ? `—(${reason})` : '—'
  }
  return kind === 'pct' ? formatPct(value) : `${value.toFixed(2)}x`
}

/**
 * シナリオ並列比較ビュー(読み取り専用)。出典: docs/phase5-spec.md §2
 * 選択状態はURLクエリ(?ids=...)で持つ。編集は各シナリオ詳細で行う。
 */
export function ScenarioComparePage() {
  const { scenarios, isLoaded, loadAll } = useScenarioStore()
  const [searchParams] = useSearchParams()
  const [benchmarkStatusBySector, setBenchmarkStatusBySector] = useState<Partial<Record<SectorId, DataStatus | 'unknown'>>>({})

  useEffect(() => {
    if (!isLoaded) void loadAll()
  }, [isLoaded, loadAll])

  const ids = (searchParams.get('ids') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const columns = isLoaded ? buildCompareColumns(ids, scenarios) : []
  const sectors = Array.from(new Set(columns.map((c) => c.scenario?.sector).filter((s): s is SectorId => Boolean(s))))

  useEffect(() => {
    if (sectors.length === 0) return
    let cancelled = false
    void Promise.all(sectors.map((s) => new StaticJsonSource().fetchSector(s).then((data) => [s, data?.data_status ?? 'unknown'] as const))).then(
      (entries) => {
        if (!cancelled) setBenchmarkStatusBySector(Object.fromEntries(entries))
      },
    )
    return () => {
      cancelled = true
    }
  }, [sectors.join(',')])

  if (!isLoaded) {
    return <p>読み込み中...</p>
  }

  if (ids.length === 0) {
    return (
      <section>
        <h1>シナリオ比較</h1>
        <p>
          比較するシナリオが選択されていません。<Link to="/">シナリオ一覧</Link>でチェックボックスから選択してください。
        </p>
      </section>
    )
  }

  const chartData = buildEvChartData(columns)
  const sectorBlocks = buildSectorBlocks(columns)

  const handleExportXlsx = () => {
    const workbook = buildCompareWorkbook(columns, benchmarkStatusBySector)
    downloadXlsxFile(`シナリオ比較_${columns.length}件.xlsx`, workbook)
  }

  return (
    <section className="scenario-compare-page">
      <h1>シナリオ比較({columns.length}件)</h1>
      <p>
        <Link to="/">← シナリオ一覧へ戻る</Link>
      </p>
      <button type="button" onClick={handleExportXlsx}>
        Excelエクスポート
      </button>

      <section>
        <h2>EVレンジ</h2>
        {chartData.length > 0 ? <EvRangeChart data={chartData} /> : <p>表示可能なシナリオがありません。</p>}
      </section>

      <section>
        <h2>共通指標</h2>
        <table>
          <thead>
            <tr>
              <th></th>
              {columns.map((c) => (
                <th key={c.id}>{columnHeader(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>セクター</td>
              {columns.map((c) => (
                <td key={c.id}>{c.scenario ? SECTOR_LABELS[c.scenario.sector] : '—'}</td>
              ))}
            </tr>
            <tr>
              <td>EV(悲観)</td>
              {columns.map((c) => (
                <td key={c.id}>{formatMoney(c.evaluation?.ok ? c.evaluation.value.ev.pessimistic : null)}</td>
              ))}
            </tr>
            <tr>
              <td>EV(ベース)</td>
              {columns.map((c) => (
                <td key={c.id}>{formatMoney(c.evaluation?.ok ? c.evaluation.value.ev.base : null)}</td>
              ))}
            </tr>
            <tr>
              <td>EV(楽観)</td>
              {columns.map((c) => (
                <td key={c.id}>{formatMoney(c.evaluation?.ok ? c.evaluation.value.ev.optimistic : null)}</td>
              ))}
            </tr>
            <tr>
              <td>VC法: 目標倍率</td>
              {columns.map((c) => (
                <td key={c.id}>{c.scenario ? `${c.scenario.vcMethod.targetMultiple.toFixed(1)}x` : '—'}</td>
              ))}
            </tr>
            <tr>
              <td>VC法: 含意IRR</td>
              {columns.map((c) => (
                <td key={c.id}>{c.scenario ? formatPct(impliedIrrFor(c.scenario)) : '—'}</td>
              ))}
            </tr>
            <tr>
              <td>VC法: 投資額</td>
              {columns.map((c) => (
                <td key={c.id}>{c.scenario ? formatMoney(c.scenario.vcMethod.investment) : '—'}</td>
              ))}
            </tr>
            <tr>
              <td>期待IRR(資本政策)</td>
              {columns.map((c) => (
                <td key={c.id}>{expectedReturnText(c.expectedReturns?.irr, c.expectedReturns?.unavailableReason, 'pct')}</td>
              ))}
            </tr>
            <tr>
              <td>期待MOIC(資本政策)</td>
              {columns.map((c) => (
                <td key={c.id}>{expectedReturnText(c.expectedReturns?.moic, c.expectedReturns?.unavailableReason, 'x')}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </section>

      {sectorBlocks.map((block) => (
        <section key={block.sector}>
          <h2>{SECTOR_LABELS[block.sector]}別指標</h2>
          <table>
            <thead>
              <tr>
                <th></th>
                {block.columnIds.map((id) => (
                  <th key={id}>{columns.find((c) => c.id === id)?.scenario?.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  {block.columnIds.map((id) => (
                    <td key={id}>{formatByField(row.valuesByColumnId[id] ?? null, row.format, row.unit)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </section>
  )
}
