/**
 * EC / D2C。
 * 出典: docs/engine-spec.md §2.5
 *
 * 評価手法: EV/売上 または EV/粗利マルチプル + ユニットエコノミクス(診断)。
 * 依存ゼロの純粋関数のみ。
 */
import { atLeast, collectIssues, inRange, positiveInteger } from '../common/validation.ts'
import type { EngineResult, Money, Range3, Ratio, SectorValuationResult, Yen } from '../types.ts'

export interface EcD2cInputs {
  annualRevenue: Money // 年間売上(GMVでなくNet売上)。≥ 0
  revenueGrowth: Ratio // > −1
  grossMargin: Ratio // [0, 1]
  f2Rate: Ratio // F2転換率(初回→2回目購入)。[0, 1)
  aov: Yen // 平均注文単価。≥ 0
  purchaseFrequency: number // 年間購入回数。≥ 0
  cac: Yen // ≥ 0
  adCostRatio: Ratio // 売上比広告費。[0, 1]
  logisticsCostRatio: Ratio // 売上比物流費。[0, 1]
  inventoryTurnover: number // 年間在庫回転数。> 0。対比指標
  multipleBasis: 'revenue' | 'grossProfit'
  evMultiple: Range3<number> // 各値 > 0
  maxLifetimeYears: number // LTV計算の上限年数。既定 10(→ U-10)
}

/**
 * Revenue_ntm = annualRevenue × (1 + revenueGrowth)
 * Basis_ntm   = Revenue_ntm                        (multipleBasis = 'revenue')
 *             = Revenue_ntm × grossMargin          (multipleBasis = 'grossProfit')
 * EV_k        = Basis_ntm × evMultiple_k
 *
 * ユニットエコノミクス(keyMetrics)(F2転換率を年次リピート率の近似とみなす → U-10):
 * annualValue    = aov × purchaseFrequency × grossMargin              [円/年]
 * lifetimeYears  = min(1 / (1 − f2Rate), maxLifetimeYears)
 * LTV            = annualValue × lifetimeYears                        [円]
 * ltvCacRatio    = LTV / cac                       (cac > 0 のときのみ)
 * contributionMarginRatio = grossMargin − adCostRatio − logisticsCostRatio
 *
 * 境界条件: annualRevenue = 0 ⇒ EV = 0。f2Rate → 1 でも lifetimeYears は上限でキャップ。
 */
export function evaluateEcD2c(inputs: EcD2cInputs): EngineResult<SectorValuationResult> {
  const issues = collectIssues(
    atLeast(inputs.annualRevenue, 'annualRevenue', 0),
    atLeast(inputs.revenueGrowth, 'revenueGrowth', -1, { exclusive: true }),
    inRange(inputs.grossMargin, 'grossMargin', 0, 1),
    inRange(inputs.f2Rate, 'f2Rate', 0, 1, { maxExclusive: true }),
    atLeast(inputs.aov, 'aov', 0),
    atLeast(inputs.purchaseFrequency, 'purchaseFrequency', 0),
    atLeast(inputs.cac, 'cac', 0),
    inRange(inputs.adCostRatio, 'adCostRatio', 0, 1),
    inRange(inputs.logisticsCostRatio, 'logisticsCostRatio', 0, 1),
    atLeast(inputs.inventoryTurnover, 'inventoryTurnover', 0, { exclusive: true }),
    atLeast(inputs.evMultiple.pessimistic, 'evMultiple.pessimistic', 0, { exclusive: true }),
    atLeast(inputs.evMultiple.base, 'evMultiple.base', 0, { exclusive: true }),
    atLeast(inputs.evMultiple.optimistic, 'evMultiple.optimistic', 0, { exclusive: true }),
    positiveInteger(inputs.maxLifetimeYears, 'maxLifetimeYears'),
  )
  if (issues.length > 0) return { ok: false, errors: issues }

  const revenueNtm = inputs.annualRevenue * (1 + inputs.revenueGrowth)
  const basisNtm = inputs.multipleBasis === 'revenue' ? revenueNtm : revenueNtm * inputs.grossMargin

  const ev = {
    pessimistic: basisNtm * inputs.evMultiple.pessimistic,
    base: basisNtm * inputs.evMultiple.base,
    optimistic: basisNtm * inputs.evMultiple.optimistic,
  }

  const annualValue = inputs.aov * inputs.purchaseFrequency * inputs.grossMargin
  const lifetimeYears = Math.min(1 / (1 - inputs.f2Rate), inputs.maxLifetimeYears)
  const ltv = annualValue * lifetimeYears

  const keyMetrics: Record<string, number> = {
    contributionMarginRatio: inputs.grossMargin - inputs.adCostRatio - inputs.logisticsCostRatio,
    ltv,
  }
  if (inputs.cac > 0) {
    keyMetrics.ltvCacRatio = ltv / inputs.cac
  }

  return { ok: true, value: { ev, keyMetrics } }
}

export const EC_D2C_SENSITIVITY_DRIVERS = ['revenueGrowth', 'evMultiple.base', 'f2Rate', 'aov'] as const

export function applyEcD2cDriver(inputs: EcD2cInputs, driverId: string, multiplier: number): EcD2cInputs {
  switch (driverId) {
    case 'revenueGrowth': {
      const value = Math.max(inputs.revenueGrowth * multiplier, -0.999)
      return { ...inputs, revenueGrowth: value }
    }
    case 'evMultiple.base': {
      const value = Math.max(inputs.evMultiple.base * multiplier, 1e-9)
      return { ...inputs, evMultiple: { ...inputs.evMultiple, base: value } }
    }
    case 'f2Rate': {
      const value = Math.min(Math.max(inputs.f2Rate * multiplier, 0), 0.999)
      return { ...inputs, f2Rate: value }
    }
    case 'aov': {
      const value = Math.max(inputs.aov * multiplier, 0)
      return { ...inputs, aov: value }
    }
    default:
      return inputs
  }
}

export function ecD2cBaseEv(inputs: EcD2cInputs): Money {
  const result = evaluateEcD2c(inputs)
  return result.ok ? result.value.ev.base : Number.NaN
}
