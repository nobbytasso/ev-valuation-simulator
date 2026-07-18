import * as XLSX from 'xlsx'
import type { CaseResult, WorkbenchState } from '../../v2/domain/types.ts'
import { getSectorDefinition } from '../../v2/domain/sectorDefinitions.ts'

function percent(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`
}

export function buildWorkbenchWorkbook(state: WorkbenchState, results: CaseResult[]): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new()
  const definition = getSectorDefinition(state.company.sector)

  const summaryRows: (string | number)[][] = [
    ['会社名', state.company.name],
    ['セクター', definition.label],
    ['評価基準日', state.company.valuationDate],
    ['評価手法', definition.valuationMethod],
    [],
    ['項目', ...state.cases.map((item) => item.name)],
    ['Exit年数', ...state.cases.map((item) => item.yearsToExit)],
    ['Exit指標', ...results.map((result) => result.exitMetric)],
    ['Exit企業価値', ...results.map((result) => result.exitEnterpriseValue)],
    ['Exit株式価値', ...results.map((result) => result.exitEquityValue)],
    ['現在許容Post-money', ...results.map((result) => result.currentAllowablePostMoney)],
    ['現在許容Pre-money', ...results.map((result) => result.currentAllowablePreMoney)],
    ['理論株価(円)', ...results.map((result) => result.theoreticalSharePrice ?? '—')],
    ['要求投資時持分', ...results.map((result) => percent(result.requiredEntryOwnership))],
    ['期待MOIC', ...results.map((result) => result.expectedMoic ?? '—')],
    ['期待IRR', ...results.map((result) => percent(result.expectedIrr))],
  ]
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary')

  const companyRows: (string | number)[][] = [
    ['項目', '値'],
    ['会社名', state.company.name],
    ['セクター', definition.label],
    ['評価基準日', state.company.valuationDate],
    ['完全希薄化後株式数(百万株)', state.company.fullyDilutedShares],
    ['提示Pre-money(百万円)', state.company.proposedPreMoney],
    ['現在Net Debt(百万円)', state.company.currentNetDebt],
    ...definition.companyFields.map((field) => [field.label, state.company.facts[field.id] ?? '']),
  ]
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(companyRows), 'Company')

  const assumptionRows: (string | number)[][] = [
    ['項目', ...state.cases.map((item) => item.name)],
    ['ケース説明', ...state.cases.map((item) => item.narrative)],
    ['Exitルート', ...state.cases.map((item) => item.exitRoute)],
    ['Exitまでの年数', ...state.cases.map((item) => item.yearsToExit)],
    ['目標MOIC', ...state.cases.map((item) => item.targetMoic)],
    ['投資額(百万円)', ...state.cases.map((item) => item.investmentAmount)],
    ['Exit時持分残存率', ...state.cases.map((item) => percent(item.dilutionRetention))],
    ['Exit Net Debt(百万円)', ...state.cases.map((item) => item.exitNetDebt)],
    ...definition.caseFields.map((field) => [
      field.label,
      ...state.cases.map((item) => item.assumptions[field.id] ?? ''),
    ]),
  ]
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(assumptionRows), 'Assumptions')
  return workbook
}

export function downloadWorkbenchWorkbook(state: WorkbenchState, results: CaseResult[]): void {
  const workbook = buildWorkbenchWorkbook(state, results)
  XLSX.writeFile(workbook, `${state.company.name}_investment_cases.xlsx`)
}
