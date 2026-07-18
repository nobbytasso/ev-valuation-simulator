/**
 * ポートフォリオサマリのExcelワークブック構築(純粋関数)。出典: docs/phase5-spec.md §4.1, §4.2
 * 日付(new Date())はこのモジュールの外(UI層)に閉じ、評価基準日はISO8601文字列で受け取る(P5-4裁定)。
 */
import * as XLSX from 'xlsx'
import type { WorkBook } from 'xlsx'
import type { DataStatus } from '../../adapters/benchmarks/types.ts'
import { SECTOR_LABELS } from '../../store/scenarioTypes.ts'
import type { PortfolioHolding, Scenario, SectorId } from '../../store/scenarioTypes.ts'
import { formatUnavailable } from '../format/unavailable.ts'
import { aggregatePortfolio, evaluateHolding } from '../portfolio/portfolioAggregation.ts'
import type { V2LinkedValuation } from '../portfolio/v2Linking.ts'
import { formatDataStatus } from './excelSheetHelpers.ts'
import type { SheetRow } from './excelSheetHelpers.ts'

function resolveScenario(holding: PortfolioHolding, scenarioById: Map<string, Scenario>): Scenario | null {
  return holding.scenarioId ? (scenarioById.get(holding.scenarioId) ?? null) : null
}

function scenarioNameCell(holding: PortfolioHolding, linkedScenario: Scenario | null): string {
  if (holding.v2CompanyId) return `(V2会社連動: ${holding.v2CompanyId})`
  if (linkedScenario) return linkedScenario.name
  return holding.scenarioId ? '(削除済み)' : '(未紐付け)'
}

function costBasisReason(holding: PortfolioHolding, linkedScenario: Scenario | null): string {
  if (holding.v2CompanyId) return '採用ケース未選択、またはV2会社削除済み'
  if (!holding.scenarioId) return '未紐付け'
  if (!linkedScenario) return 'シナリオ削除済み'
  return '評価不能(入力エラー)'
}

function evaluationMethodCell(holding: PortfolioHolding, isCostBasis: boolean): string {
  if (isCostBasis) return 'コスト評価'
  return holding.v2CompanyId ? 'V2採用ケース' : 'シナリオ'
}

function buildSummarySheetRows(
  holdings: PortfolioHolding[],
  scenarioById: Map<string, Scenario>,
  evalDateIso: string,
  v2ValuationByCompanyId: Map<string, V2LinkedValuation | null>,
): SheetRow[] {
  const rows: SheetRow[] = []
  rows.push([
    '企業名',
    'セクター',
    '投資日',
    '投資額(百万円)',
    '持分(%)',
    '評価シナリオ名',
    '時価(悲観、百万円)',
    '時価(ベース、百万円)',
    '時価(楽観、百万円)',
    'MOIC(x)',
    'IRR(%)',
    '評価方法',
  ])
  for (const h of holdings) {
    const linkedScenario = resolveScenario(h, scenarioById)
    const v2Valuation = h.v2CompanyId ? (v2ValuationByCompanyId.get(h.v2CompanyId) ?? null) : null
    const valuation = evaluateHolding(h, linkedScenario, evalDateIso, v2Valuation)
    rows.push([
      h.companyName,
      SECTOR_LABELS[h.sector],
      h.investmentDate ?? '未設定',
      h.investmentAmount,
      h.ownershipPct * 100,
      scenarioNameCell(h, linkedScenario),
      valuation.marketValue.pessimistic,
      valuation.marketValue.base,
      valuation.marketValue.optimistic,
      valuation.moic ?? formatUnavailable(valuation.moicUnavailableReason),
      valuation.irr !== null ? valuation.irr * 100 : formatUnavailable(valuation.irrUnavailableReason),
      evaluationMethodCell(h, valuation.isCostBasis),
    ])
  }
  rows.push([])

  const summary = aggregatePortfolio(holdings, scenarioById, evalDateIso, v2ValuationByCompanyId)
  rows.push([
    'ファンド合計',
    '',
    '',
    summary.totalInvestment,
    '',
    '',
    summary.totalMarketValue.pessimistic,
    summary.totalMarketValue.base,
    summary.totalMarketValue.optimistic,
    summary.fundMoic ?? formatUnavailable(summary.fundMoicUnavailableReason),
    summary.fundIrr !== null ? summary.fundIrr * 100 : formatUnavailable(summary.fundIrrUnavailableReason),
    summary.hasCostBasisHoldings ? 'コスト評価銘柄を含む' : '',
  ])
  return rows
}

function buildPortfolioAssumptionsSheetRows(
  holdings: PortfolioHolding[],
  scenarioById: Map<string, Scenario>,
  evalDateIso: string,
  benchmarkStatusBySector: Partial<Record<SectorId, DataStatus | 'unknown'>>,
  v2ValuationByCompanyId: Map<string, V2LinkedValuation | null>,
): SheetRow[] {
  const rows: SheetRow[] = []
  rows.push(['評価基準日', evalDateIso.slice(0, 10)])
  rows.push([])

  rows.push(['銘柄別: 紐付けシナリオ・Exit参照レンジ'])
  rows.push(['企業名', '紐付けシナリオ名', 'exitEvSource'])
  for (const h of holdings) {
    const linkedScenario = resolveScenario(h, scenarioById)
    rows.push([h.companyName, scenarioNameCell(h, linkedScenario), linkedScenario?.capitalPolicy.exitEvSource ?? ''])
  }
  rows.push([])

  rows.push(['コスト評価銘柄一覧(P5-1: 投資額で代替)'])
  rows.push(['企業名', '理由'])
  for (const h of holdings) {
    const linkedScenario = resolveScenario(h, scenarioById)
    const v2Valuation = h.v2CompanyId ? (v2ValuationByCompanyId.get(h.v2CompanyId) ?? null) : null
    const valuation = evaluateHolding(h, linkedScenario, evalDateIso, v2Valuation)
    if (valuation.isCostBasis) rows.push([h.companyName, costBasisReason(h, linkedScenario)])
  }
  rows.push([])

  rows.push(['ベンチマークデータの状態(セクター別)'])
  rows.push(['セクター', '状態'])
  const sectors = Array.from(new Set(holdings.map((h) => h.sector)))
  for (const sector of sectors) {
    rows.push([SECTOR_LABELS[sector], formatDataStatus(benchmarkStatusBySector[sector] ?? 'unknown')])
  }
  return rows
}

export function buildPortfolioWorkbook(
  holdings: PortfolioHolding[],
  scenarioById: Map<string, Scenario>,
  evalDateIso: string,
  benchmarkStatusBySector: Partial<Record<SectorId, DataStatus | 'unknown'>> = {},
  v2ValuationByCompanyId: Map<string, V2LinkedValuation | null> = new Map(),
): WorkBook {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(buildSummarySheetRows(holdings, scenarioById, evalDateIso, v2ValuationByCompanyId)),
    'サマリ',
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(
      buildPortfolioAssumptionsSheetRows(holdings, scenarioById, evalDateIso, benchmarkStatusBySector, v2ValuationByCompanyId),
    ),
    '前提条件',
  )
  return workbook
}
