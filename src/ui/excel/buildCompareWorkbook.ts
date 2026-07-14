/**
 * シナリオ比較のExcelワークブック構築(純粋関数)。出典: docs/phase5-spec.md §4.1, §4.2
 * 「比較」シートは§2.2の共通ブロック+セクター別ブロックと同一内容(行=指標、列=シナリオ)。
 * 「前提条件」シートはシナリオ毎に §1.2 展開(buildScenarioAssumptionRows)を縦に連結する。
 */
import * as XLSX from 'xlsx'
import type { WorkBook } from 'xlsx'
import type { DataStatus } from '../../adapters/benchmarks/types.ts'
import { SECTOR_LABELS } from '../../store/scenarioTypes.ts'
import type { SectorId } from '../../store/scenarioTypes.ts'
import type { CompareColumn } from '../compare/compareEngine.ts'
import { buildSectorBlocks, impliedIrrFor } from '../compare/compareEngine.ts'
import { buildScenarioAssumptionRows } from './excelSheetHelpers.ts'
import type { SheetRow } from './excelSheetHelpers.ts'

function columnHeader(col: CompareColumn): string {
  return col.found && col.scenario ? col.scenario.name : '見つかりません'
}

function expectedReturnCell(value: number | null | undefined, reason: string | null | undefined): string | number {
  if (value === null || value === undefined) return reason ? `—(${reason})` : '—'
  return value
}

function buildCompareSheetRows(columns: CompareColumn[]): SheetRow[] {
  const rows: SheetRow[] = []
  rows.push(['指標', ...columns.map(columnHeader)])
  rows.push(['セクター', ...columns.map((c) => (c.scenario ? SECTOR_LABELS[c.scenario.sector] : ''))])
  rows.push(['EV(悲観、百万円)', ...columns.map((c) => (c.evaluation?.ok ? c.evaluation.value.ev.pessimistic : ''))])
  rows.push(['EV(ベース、百万円)', ...columns.map((c) => (c.evaluation?.ok ? c.evaluation.value.ev.base : ''))])
  rows.push(['EV(楽観、百万円)', ...columns.map((c) => (c.evaluation?.ok ? c.evaluation.value.ev.optimistic : ''))])
  rows.push(['VC法: 目標倍率(x)', ...columns.map((c) => c.scenario?.vcMethod.targetMultiple ?? '')])
  rows.push(['VC法: 含意IRR(%)', ...columns.map((c) => (c.scenario ? impliedIrrFor(c.scenario) * 100 : ''))])
  rows.push(['VC法: 投資額(百万円)', ...columns.map((c) => c.scenario?.vcMethod.investment ?? '')])
  rows.push(['期待IRR(資本政策、%)', ...columns.map((c) => {
    const cell = expectedReturnCell(c.expectedReturns?.irr, c.expectedReturns?.unavailableReason)
    return typeof cell === 'number' ? cell * 100 : cell
  })])
  rows.push(['期待MOIC(資本政策、x)', ...columns.map((c) => expectedReturnCell(c.expectedReturns?.moic, c.expectedReturns?.unavailableReason))])
  rows.push([])

  for (const block of buildSectorBlocks(columns)) {
    rows.push([`${SECTOR_LABELS[block.sector]}別指標`])
    for (const row of block.rows) {
      const label = row.unit ? `${row.label}(${row.unit})` : row.label
      rows.push([
        label,
        ...columns.map((c) => {
          if (!block.columnIds.includes(c.id)) return ''
          const raw = row.valuesByColumnId[c.id]
          if (raw === null || raw === undefined) return ''
          return row.format === 'ratio' ? raw * 100 : raw
        }),
      ])
    }
    rows.push([])
  }
  return rows
}

function buildCompareAssumptionsSheetRows(
  columns: CompareColumn[],
  benchmarkStatusBySector: Partial<Record<SectorId, DataStatus | 'unknown'>>,
): SheetRow[] {
  const rows: SheetRow[] = []
  for (const col of columns) {
    if (!col.scenario) continue
    rows.push([`■ ${SECTOR_LABELS[col.scenario.sector]}: ${col.scenario.name}`])
    rows.push(...buildScenarioAssumptionRows(col.scenario, benchmarkStatusBySector[col.scenario.sector] ?? 'unknown'))
    rows.push([])
  }
  return rows
}

export function buildCompareWorkbook(
  columns: CompareColumn[],
  benchmarkStatusBySector: Partial<Record<SectorId, DataStatus | 'unknown'>> = {},
): WorkBook {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(buildCompareSheetRows(columns)), '比較')
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(buildCompareAssumptionsSheetRows(columns, benchmarkStatusBySector)),
    '前提条件',
  )
  return workbook
}
