/**
 * V2 Investment Case Workbench: セクター別 Exit 評価。
 * 出典: docs/engine-spec.md §5
 *
 * `src/v2/domain/sectorDefinitions.ts` の各 `evaluate` の計算部分を、プレーンな数値引数の
 * 純粋関数として移設したもの(裁定①)。ValueBag/FieldDefinition 等のUI概念は持ち込まない
 * (`numberValue`/`stringValue` による値取り出しはUI層 `src/v2/domain/` に残す)。
 *
 * 依存ゼロ。医療機器のみ現在価値算出に `../common/npv.ts` の既存関数を再利用する
 * (v2独自のpresentValue/terminalValue実装は重複のため削除。rate<=g で0を返すv2仕様は
 * ここで既存 `terminalValue`(EngineResult版)をガードして吸収する)。
 */
import { presentValue, presentValueOfTerminalValue, terminalValue } from '../common/npv.ts'
import type { Cashflow } from '../common/npv.ts'
import type { Money, Ratio } from '../types.ts'
import { projectMetric } from './valuation.ts'
import type {
  WorkbenchClimateTechExitInputs,
  WorkbenchDrugDiscoveryExitInputs,
  WorkbenchEcD2cExitInputs,
  WorkbenchExitValuation,
  WorkbenchMediaTechExitInputs,
  WorkbenchMedicalDeviceExitInputs,
  WorkbenchSaasExitInputs,
} from './types.ts'

export function workbenchSaasExit(inputs: WorkbenchSaasExitInputs): WorkbenchExitValuation {
  const projection = projectMetric(inputs.currentArr, inputs.arrGrowth, inputs.growthDecay, inputs.yearsToExit)
  const exitEv = projection.value * inputs.exitMultiple
  const ruleOf40 = (projection.finalGrowth + inputs.exitOperatingMargin) * 100
  return {
    exitMetricLabel: 'Exit ARR',
    exitMetric: projection.value,
    exitEnterpriseValue: exitEv,
    diagnostics: { exitGrowthRate: projection.finalGrowth, ruleOf40 },
  }
}

export function workbenchEcD2cExit(inputs: WorkbenchEcD2cExitInputs): WorkbenchExitValuation {
  const projection = projectMetric(
    inputs.currentRevenue,
    inputs.revenueGrowth,
    inputs.growthDecay,
    inputs.yearsToExit,
  )
  const metric = inputs.multipleBasis === 'grossProfit' ? projection.value * inputs.exitGrossMargin : projection.value
  const exitEv = metric * inputs.exitMultiple
  return {
    exitMetricLabel: inputs.multipleBasis === 'grossProfit' ? 'Exit粗利' : 'Exit売上',
    exitMetric: metric,
    exitEnterpriseValue: exitEv,
    diagnostics: { exitRevenue: projection.value, exitGrossMargin: inputs.exitGrossMargin },
  }
}

export function workbenchMediaTechExit(inputs: WorkbenchMediaTechExitInputs): WorkbenchExitValuation {
  const mau = projectMetric(inputs.currentMau, inputs.mauGrowth, inputs.growthDecay, inputs.yearsToExit)
  const arpu = projectMetric(inputs.currentMonthlyArpu, inputs.arpuGrowth, 1, inputs.yearsToExit)
  const exitRevenue = (mau.value * arpu.value * 12) / 1e6
  const exitEv = exitRevenue * inputs.exitMultiple
  return {
    exitMetricLabel: 'Exit売上',
    exitMetric: exitRevenue,
    exitEnterpriseValue: exitEv,
    diagnostics: { exitMau: mau.value, exitMonthlyArpu: arpu.value },
  }
}

/** v2独自 terminalValue の rate<=g ⇒ 0 という仕様を、既存 `terminalValue`(EngineResult版)をガードして再現する。 */
function terminalValueGuarded(finalCf: Money, rate: Ratio, terminalGrowth: Ratio): Money {
  if (rate <= terminalGrowth) return 0
  const result = terminalValue(finalCf, rate, terminalGrowth)
  return result.ok ? result.value : 0
}

export function workbenchMedicalDeviceExit(inputs: WorkbenchMedicalDeviceExitInputs): WorkbenchExitValuation {
  const launch = inputs.launchYear + inputs.approvalDelayYears
  const yearsToPeak = Math.max(1, inputs.yearsToPeak || 1)
  const projectionYears = Math.max(10, inputs.yearsToExit)
  const cashflowValues: number[] = []
  let exitRevenue = 0

  for (let year = 1; year <= projectionYears; year += 1) {
    const procedures = inputs.annualProcedures * Math.pow(1 + inputs.procedureGrowth, year)
    const penetration =
      year < launch ? 0 : Math.min(inputs.peakPenetration, (inputs.peakPenetration * (year - launch + 1)) / yearsToPeak)
    const deviceRevenue = (procedures * penetration * inputs.pricePerProcedure) / 1e6
    const totalRevenue = inputs.recurringRatio < 1 ? deviceRevenue / (1 - inputs.recurringRatio) : 0
    cashflowValues.push(totalRevenue * inputs.operatingMargin)
    if (year === inputs.yearsToExit) exitRevenue = totalRevenue
  }

  const cashflows: Cashflow[] = cashflowValues.map((cf, index) => ({ t: index + 1, cf }))
  const finalCf = cashflowValues.at(-1) ?? 0
  const tv = terminalValueGuarded(finalCf, inputs.discountRate, inputs.terminalGrowth)
  const intrinsic =
    presentValue(inputs.discountRate, cashflows) +
    presentValueOfTerminalValue(tv, inputs.discountRate, projectionYears)
  const exitEv = exitRevenue * inputs.exitMultiple

  return {
    exitMetricLabel: 'Exit売上',
    exitMetric: exitRevenue,
    exitEnterpriseValue: exitEv,
    intrinsicValue: intrinsic,
    diagnostics: { effectiveLaunchYear: launch, exitRevenue },
    warnings: inputs.discountRate <= inputs.terminalGrowth ? ['割引率は永久成長率を上回る必要があります。'] : [],
  }
}

export function workbenchDrugDiscoveryExit(inputs: WorkbenchDrugDiscoveryExitInputs): WorkbenchExitValuation {
  const peakSales = inputs.currentPeakSales * Math.pow(1 + inputs.peakSalesGrowth, inputs.yearsToExit)
  const riskAdjustedEconomicValue = peakSales * inputs.posAtExit * inputs.valueCaptureRate
  const exitEv = riskAdjustedEconomicValue * inputs.exitMultiple
  return {
    exitMetricLabel: 'リスク調整後経済価値',
    exitMetric: riskAdjustedEconomicValue,
    exitEnterpriseValue: exitEv,
    intrinsicValue: inputs.currentRnpv,
    diagnostics: { peakSalesAtExit: peakSales, posAtExit: inputs.posAtExit },
    warnings: ['Exit価値はイベント取引価値の簡易モデルです。案件固有の導出・M&A条件で調整してください。'],
  }
}

export function workbenchClimateTechExit(inputs: WorkbenchClimateTechExitInputs): WorkbenchExitValuation {
  const realization =
    inputs.offtakeCoverage + (1 - inputs.offtakeCoverage) * inputs.merchantRealization
  const costAtExit = inputs.unitCost * Math.pow(1 - inputs.costDeclineRate, inputs.yearsToExit)
  const unitMargin = inputs.unitPrice - costAtExit
  const operatingContribution = (inputs.annualCapacity * realization * unitMargin) / 1e6
  const carbonRevenue = (inputs.carbonCreditVolume * inputs.carbonCreditPrice) / 1e6
  const ebitda = operatingContribution + carbonRevenue - inputs.fixedOpex
  const riskAdjustedEbitda = ebitda * inputs.massProductionProbability
  const exitEv = riskAdjustedEbitda * inputs.exitMultiple
  return {
    exitMetricLabel: '確率調整後Exit EBITDA',
    exitMetric: riskAdjustedEbitda,
    exitEnterpriseValue: exitEv,
    intrinsicValue: inputs.currentProjectNpv,
    diagnostics: { exitUnitCost: costAtExit, unadjustedExitEbitda: ebitda },
  }
}
