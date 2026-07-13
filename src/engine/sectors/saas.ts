/**
 * SaaS(日本市場)。
 * 出典: docs/engine-spec.md §2.1
 *
 * 評価手法: EV/ARR マルチプル(主)+ 簡易DCF(補助)
 * 依存ゼロの純粋関数のみ。
 */
import { presentValue, presentValueOfTerminalValue, terminalValue } from '../common/npv.ts'
import type { EngineResult, Money, Range3, Ratio, SectorValuationResult } from '../types.ts'

export interface SaasInputs {
  arr: Money // 現在(実績)ARR。≥ 0
  arrGrowth: Ratio // 直近YoY成長率。> −1
  nrr: Ratio // 例 1.10。対比指標(→ U-3)
  grossMargin: Ratio // [0, 1]。対比指標
  operatingMargin: Ratio // [−1, 1]。Rule of 40 に使用
  fcfMargin: Ratio // [−1, 1]。DCFに使用
  grossChurn: Ratio // 年間。[0, 1]。対比指標
  cacPaybackMonths: number // > 0。対比指標
  arrBasis: 'current' | 'ntm' // マルチプル適用基準。既定 'ntm'(→ U-1)
  evArrMultiple: Range3<number> // 各値 > 0
  // 簡易DCF用
  projectionYears: number // 既定 5
  growthDecayFactor: Ratio // 年次成長率減衰係数。既定 0.85(仮値 → U-2)
  discountRate: Ratio // DCF用。r > g_term
  terminalGrowth: Ratio // 既定 0.02(仮値)
}

/**
 * 主評価(マルチプル):
 * ARR_basis = arr                    (arrBasis = 'current')
 *           = arr × (1 + arrGrowth)  (arrBasis = 'ntm')
 * EV_k = ARR_basis × evArrMultiple_k
 *
 * 補助評価(簡易DCF、単一値):
 * g_t        = arrGrowth × growthDecayFactor^(t−1)        (t = 1..T)
 * Revenue_t  = Revenue_{t−1} × (1 + g_t)
 * FCF_t      = Revenue_t × fcfMargin                       (マージンは一定 → U-2)
 * EV_dcf     = Σ_{t=1}^{T} FCF_t/(1+r)^t + TV_T/(1+r)^T
 *
 * 境界条件: arr = 0 ⇒ EV = 0。r ≤ terminalGrowth は ValidationIssue。
 */
export function evaluateSaas(inputs: SaasInputs): EngineResult<SectorValuationResult> {
  if (inputs.discountRate <= inputs.terminalGrowth) {
    return {
      ok: false,
      errors: [
        {
          field: 'discountRate',
          code: 'TERMINAL_GROWTH_GTE_DISCOUNT',
          message: '割引率は永久成長率を上回る必要があります',
        },
      ],
    }
  }

  const arrBasisValue = inputs.arrBasis === 'current' ? inputs.arr : inputs.arr * (1 + inputs.arrGrowth)
  const ev = {
    pessimistic: arrBasisValue * inputs.evArrMultiple.pessimistic,
    base: arrBasisValue * inputs.evArrMultiple.base,
    optimistic: arrBasisValue * inputs.evArrMultiple.optimistic,
  }

  const cashflows: { t: number; cf: Money }[] = []
  let revenue = inputs.arr
  for (let t = 1; t <= inputs.projectionYears; t++) {
    const g = inputs.arrGrowth * Math.pow(inputs.growthDecayFactor, t - 1)
    revenue = revenue * (1 + g)
    cashflows.push({ t, cf: revenue * inputs.fcfMargin })
  }
  const finalCf = cashflows.length > 0 ? cashflows[cashflows.length - 1].cf : 0
  const tvResult = terminalValue(finalCf, inputs.discountRate, inputs.terminalGrowth)
  if (!tvResult.ok) return tvResult
  const auxiliary =
    presentValue(inputs.discountRate, cashflows) +
    presentValueOfTerminalValue(tvResult.value, inputs.discountRate, inputs.projectionYears)

  const keyMetrics: Record<string, number> = {
    ruleOf40: (inputs.arrGrowth + inputs.operatingMargin) * 100,
  }

  return { ok: true, value: { ev, auxiliary, keyMetrics, cashflows } }
}

/** 感度分析の対象ドライバー(§1.5)。 */
export const SAAS_SENSITIVITY_DRIVERS = ['arrGrowth', 'evArrMultiple.base', 'discountRate', 'fcfMargin'] as const

/**
 * ドライバーを相対変動させ、定義域端にクランプする(§1.5, U-15)。
 * evAtLow/evAtHigh は「マルチプル評価EV(base)」を対象とする。
 */
export function applySaasDriver(inputs: SaasInputs, driverId: string, multiplier: number): SaasInputs {
  switch (driverId) {
    case 'arrGrowth': {
      // arrGrowth > -1 の定義域。0付近も含むため乗算後に -0.999 でクランプ。
      const value = inputs.arrGrowth * multiplier
      return { ...inputs, arrGrowth: Math.max(value, -0.999) }
    }
    case 'evArrMultiple.base': {
      const value = Math.max(inputs.evArrMultiple.base * multiplier, 1e-9)
      return { ...inputs, evArrMultiple: { ...inputs.evArrMultiple, base: value } }
    }
    case 'discountRate': {
      const value = Math.max(inputs.discountRate * multiplier, inputs.terminalGrowth + 1e-6)
      return { ...inputs, discountRate: value }
    }
    case 'fcfMargin': {
      const value = Math.min(Math.max(inputs.fcfMargin * multiplier, -1), 1)
      return { ...inputs, fcfMargin: value }
    }
    default:
      return inputs
  }
}

export function saasBaseEv(inputs: SaasInputs): Money {
  const result = evaluateSaas(inputs)
  return result.ok ? result.value.ev.base : Number.NaN
}
