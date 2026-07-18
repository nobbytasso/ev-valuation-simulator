import { buildWorkbenchCaseResult, projectMetric } from '../../engine/workbench/valuation.ts'
import type { WorkbenchExitValuation } from '../../engine/workbench/types.ts'
import type { CaseResult, CompanyProfile, InvestmentCase } from './types.ts'

// 計算本体は src/engine/workbench/ へ移設済み(裁定①、v2-adoption-spec.md §1)。
// このファイルはUI型(CompanyProfile/InvestmentCase/ValueBag)とengineの薄い結線のみを担う。
export { projectMetric }

export type ExitValuationInput = WorkbenchExitValuation

export function buildCaseResult(
  company: CompanyProfile,
  investmentCase: InvestmentCase,
  exit: ExitValuationInput,
): CaseResult {
  return buildWorkbenchCaseResult(
    {
      fullyDilutedShares: company.fullyDilutedShares,
      proposedPreMoney: company.proposedPreMoney,
      investmentAmount: investmentCase.investmentAmount,
      targetMoic: investmentCase.targetMoic,
      yearsToExit: investmentCase.yearsToExit,
      dilutionRetention: investmentCase.dilutionRetention,
      exitNetDebt: investmentCase.exitNetDebt,
    },
    exit,
  )
}

export function numberValue(
  values: Record<string, number | string>,
  key: string,
  fallback = 0,
): number {
  const value = values[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function stringValue(
  values: Record<string, number | string>,
  key: string,
  fallback = '',
): string {
  const value = values[key]
  return typeof value === 'string' ? value : fallback
}
