import type { CaseResult, CompanyProfile, InvestmentCase } from './types.ts'

export interface ExitValuationInput {
  exitMetricLabel: string
  exitMetric: number
  exitEnterpriseValue: number
  intrinsicValue?: number
  diagnostics?: Record<string, number>
  warnings?: string[]
}

export function projectMetric(
  currentValue: number,
  initialGrowth: number,
  growthDecay: number,
  years: number,
): { value: number; finalGrowth: number; series: number[] } {
  let value = currentValue
  const series: number[] = []
  let finalGrowth = initialGrowth

  for (let year = 1; year <= Math.max(0, Math.floor(years)); year += 1) {
    const growth = initialGrowth * Math.pow(growthDecay, year - 1)
    value *= 1 + growth
    finalGrowth = growth
    series.push(value)
  }

  return { value, finalGrowth, series }
}

export function presentValue(rate: number, cashflows: number[]): number {
  return cashflows.reduce((sum, cashflow, index) => sum + cashflow / Math.pow(1 + rate, index + 1), 0)
}

export function terminalValue(finalCashflow: number, rate: number, terminalGrowth: number): number {
  if (rate <= terminalGrowth) return 0
  return (finalCashflow * (1 + terminalGrowth)) / (rate - terminalGrowth)
}

export function buildCaseResult(
  company: CompanyProfile,
  investmentCase: InvestmentCase,
  exit: ExitValuationInput,
): CaseResult {
  const warnings = [...(exit.warnings ?? [])]
  const exitEquityValue = exit.exitEnterpriseValue - investmentCase.exitNetDebt
  const targetMoic = investmentCase.targetMoic
  const yearsToExit = investmentCase.yearsToExit
  const investment = investmentCase.investmentAmount

  const currentAllowablePostMoney =
    exitEquityValue > 0 && targetMoic > 0 ? exitEquityValue / targetMoic : 0
  const currentAllowablePreMoney = currentAllowablePostMoney - investment
  const requiredEntryOwnership =
    currentAllowablePostMoney > 0 ? investment / currentAllowablePostMoney : 0
  const impliedTargetIrr =
    targetMoic > 0 && yearsToExit > 0 ? Math.pow(targetMoic, 1 / yearsToExit) - 1 : 0

  const theoreticalSharePrice =
    company.fullyDilutedShares > 0 ? currentAllowablePreMoney / company.fullyDilutedShares : null
  const proposedPricePerShare =
    company.fullyDilutedShares > 0 ? company.proposedPreMoney / company.fullyDilutedShares : null
  const valuationGapToProposed =
    company.proposedPreMoney > 0 ? currentAllowablePreMoney / company.proposedPreMoney - 1 : null

  const proposedPostMoney = company.proposedPreMoney + investment
  const expectedEntryOwnership = proposedPostMoney > 0 ? investment / proposedPostMoney : 0
  const expectedExitOwnership = expectedEntryOwnership * investmentCase.dilutionRetention
  const expectedProceeds = Math.max(0, exitEquityValue) * expectedExitOwnership
  const expectedMoic = investment > 0 ? expectedProceeds / investment : null
  const expectedIrr =
    expectedMoic !== null && expectedMoic >= 0 && yearsToExit > 0
      ? Math.pow(expectedMoic, 1 / yearsToExit) - 1
      : null

  if (exit.exitEnterpriseValue <= 0) warnings.push('Exit企業価値が0以下です。')
  if (exitEquityValue <= 0) warnings.push('Exit株式価値が0以下です。')
  if (currentAllowablePreMoney < 0) warnings.push('要求リターンから逆算した許容Pre-moneyが0未満です。')
  if (requiredEntryOwnership > 1) warnings.push('要求持分が100%を超えており、この条件では投資が成立しません。')
  if (investmentCase.dilutionRetention <= 0 || investmentCase.dilutionRetention > 1) {
    warnings.push('持分残存率は0%超100%以下にしてください。')
  }

  return {
    exitMetricLabel: exit.exitMetricLabel,
    exitMetric: exit.exitMetric,
    exitEnterpriseValue: exit.exitEnterpriseValue,
    exitEquityValue,
    currentAllowablePostMoney,
    currentAllowablePreMoney,
    theoreticalSharePrice,
    requiredEntryOwnership,
    impliedTargetIrr,
    proposedPricePerShare,
    valuationGapToProposed,
    expectedEntryOwnership,
    expectedExitOwnership,
    expectedProceeds,
    expectedMoic,
    expectedIrr,
    intrinsicValue: exit.intrinsicValue,
    diagnostics: exit.diagnostics ?? {},
    warnings: [...new Set(warnings)],
  }
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
