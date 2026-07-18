/**
 * V2 Investment Case Workbench モデルの型定義。
 * 出典: docs/engine-spec.md §5
 *
 * このファイルは依存ゼロ(型定義のみ、`../types.ts` の基本型のみ利用)。
 * UI概念(ValueBag・FieldDefinition・CompanyProfile・InvestmentCase 等)は持ち込まない。
 * プレーンな数値引数の純粋関数として src/v2/domain/ から移設したもの。
 */
import type { Money, Ratio, Yen } from '../types.ts'

/** Valuation Bridge の入力となる会社・ケース側の数値のみ(UI型を経由しない)。 */
export interface WorkbenchCaseCoreInputs {
  fullyDilutedShares: number // 百万株
  proposedPreMoney: Money
  investmentAmount: Money
  targetMoic: number
  yearsToExit: number
  dilutionRetention: Ratio
  exitNetDebt: Money
}

/** セクター別Exit評価関数の共通出力(Valuation Bridgeへの入力)。 */
export interface WorkbenchExitValuation {
  exitMetricLabel: string
  exitMetric: number
  exitEnterpriseValue: Money
  intrinsicValue?: Money
  diagnostics?: Record<string, number>
  warnings?: string[]
}

/** Valuation Bridge + 期待リターン順算の結果。 */
export interface WorkbenchCaseResult {
  exitMetricLabel: string
  exitMetric: number
  exitEnterpriseValue: Money
  exitEquityValue: Money
  currentAllowablePostMoney: Money
  currentAllowablePreMoney: Money
  theoreticalSharePrice: number | null
  requiredEntryOwnership: Ratio
  impliedTargetIrr: Ratio
  proposedPricePerShare: number | null
  valuationGapToProposed: Ratio | null
  expectedEntryOwnership: Ratio
  expectedExitOwnership: Ratio
  expectedProceeds: Money
  expectedMoic: number | null
  expectedIrr: Ratio | null
  intrinsicValue?: Money
  diagnostics: Record<string, number>
  warnings: string[]
}

export interface WorkbenchSaasExitInputs {
  currentArr: Money
  arrGrowth: Ratio
  growthDecay: Ratio
  exitOperatingMargin: Ratio
  exitMultiple: number
  yearsToExit: number
}

export interface WorkbenchEcD2cExitInputs {
  currentRevenue: Money
  revenueGrowth: Ratio
  growthDecay: Ratio
  exitGrossMargin: Ratio
  multipleBasis: 'revenue' | 'grossProfit'
  exitMultiple: number
  yearsToExit: number
}

export interface WorkbenchMediaTechExitInputs {
  currentMau: number
  mauGrowth: Ratio
  growthDecay: Ratio
  currentMonthlyArpu: Yen
  arpuGrowth: Ratio
  exitMultiple: number
  yearsToExit: number
}

export interface WorkbenchMedicalDeviceExitInputs {
  annualProcedures: number
  pricePerProcedure: Yen
  launchYear: number
  recurringRatio: Ratio
  procedureGrowth: Ratio
  approvalDelayYears: number
  peakPenetration: Ratio
  yearsToPeak: number
  operatingMargin: Ratio
  discountRate: Ratio
  terminalGrowth: Ratio
  exitMultiple: number
  yearsToExit: number
}

export interface WorkbenchDrugDiscoveryExitInputs {
  currentRnpv: Money
  currentPeakSales: Money
  peakSalesGrowth: Ratio
  yearsToExit: number
  posAtExit: Ratio
  valueCaptureRate: Ratio
  exitMultiple: number
}

export interface WorkbenchClimateTechExitInputs {
  currentProjectNpv: Money
  annualCapacity: number
  unitPrice: Yen
  unitCost: Yen
  fixedOpex: Money
  carbonCreditVolume: number
  massProductionProbability: Ratio
  offtakeCoverage: Ratio
  merchantRealization: Ratio
  costDeclineRate: Ratio
  carbonCreditPrice: Yen
  exitMultiple: number
  yearsToExit: number
}
