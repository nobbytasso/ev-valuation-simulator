/**
 * V2 Investment Case Workbench: 成長投影 + Valuation Bridge。
 * 出典: docs/engine-spec.md §5
 *
 * 依存ゼロの純粋関数のみ。`src/v2/domain/valuation.ts` から移設(裁定①)。
 */
import type { Money, Ratio } from '../types.ts'
import type { WorkbenchCaseCoreInputs, WorkbenchCaseResult, WorkbenchExitValuation } from './types.ts'

/**
 * g_t = initialGrowth × growthDecay^(t−1)      (t = 1..years)
 * value_t = value_{t−1} × (1 + g_t)
 * 年次成長率減衰を伴う指標投影(ARR・MAU・売上等セクター共通)。
 */
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

/**
 * Valuation Bridge(共通、docs/redesign-v2.md §4):
 *
 * ExitEquityValue = ExitEnterpriseValue − ExitNetDebt
 * CurrentAllowablePostMoney = ExitEquityValue / TargetMOIC        (ExitEquityValue>0 かつ TargetMOIC>0 のときのみ、それ以外0)
 * CurrentAllowablePreMoney  = CurrentAllowablePostMoney − Investment
 * TheoreticalSharePrice     = CurrentAllowablePreMoney / FullyDilutedShares (株式数>0のときのみ、それ以外null)
 *
 * 提示条件からの順算:
 * ExpectedEntryOwnership = Investment / (ProposedPreMoney + Investment)
 * ExpectedExitOwnership  = ExpectedEntryOwnership × DilutionRetention
 * ExpectedProceeds       = max(0, ExitEquityValue) × ExpectedExitOwnership
 * ExpectedMOIC           = ExpectedProceeds / Investment (Investment>0のときのみ、それ以外null)
 * ExpectedIRR            = ExpectedMOIC^(1/YearsToExit) − 1 (ExpectedMOIC≥0 かつ YearsToExit>0 のときのみ、それ以外null)
 */
export function buildWorkbenchCaseResult(
  core: WorkbenchCaseCoreInputs,
  exit: WorkbenchExitValuation,
): WorkbenchCaseResult {
  const warnings = [...(exit.warnings ?? [])]
  const exitEquityValue = exit.exitEnterpriseValue - core.exitNetDebt
  const targetMoic = core.targetMoic
  const yearsToExit = core.yearsToExit
  const investment = core.investmentAmount

  const currentAllowablePostMoney: Money =
    exitEquityValue > 0 && targetMoic > 0 ? exitEquityValue / targetMoic : 0
  const currentAllowablePreMoney: Money = currentAllowablePostMoney - investment
  const requiredEntryOwnership: Ratio =
    currentAllowablePostMoney > 0 ? investment / currentAllowablePostMoney : 0
  const impliedTargetIrr: Ratio =
    targetMoic > 0 && yearsToExit > 0 ? Math.pow(targetMoic, 1 / yearsToExit) - 1 : 0

  const theoreticalSharePrice =
    core.fullyDilutedShares > 0 ? currentAllowablePreMoney / core.fullyDilutedShares : null
  const proposedPricePerShare =
    core.fullyDilutedShares > 0 ? core.proposedPreMoney / core.fullyDilutedShares : null
  const valuationGapToProposed =
    core.proposedPreMoney > 0 ? currentAllowablePreMoney / core.proposedPreMoney - 1 : null

  const proposedPostMoney = core.proposedPreMoney + investment
  const expectedEntryOwnership: Ratio = proposedPostMoney > 0 ? investment / proposedPostMoney : 0
  const expectedExitOwnership: Ratio = expectedEntryOwnership * core.dilutionRetention
  const expectedProceeds: Money = Math.max(0, exitEquityValue) * expectedExitOwnership
  const expectedMoic = investment > 0 ? expectedProceeds / investment : null
  const expectedIrr =
    expectedMoic !== null && expectedMoic >= 0 && yearsToExit > 0
      ? Math.pow(expectedMoic, 1 / yearsToExit) - 1
      : null

  if (exit.exitEnterpriseValue <= 0) warnings.push('Exit企業価値が0以下です。')
  if (exitEquityValue <= 0) warnings.push('Exit株式価値が0以下です。')
  if (currentAllowablePreMoney < 0) warnings.push('要求リターンから逆算した許容Pre-moneyが0未満です。')
  if (requiredEntryOwnership > 1) warnings.push('要求持分が100%を超えており、この条件では投資が成立しません。')
  if (core.dilutionRetention <= 0 || core.dilutionRetention > 1) {
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
