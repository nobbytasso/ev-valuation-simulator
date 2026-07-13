/**
 * 医療機器。
 * 出典: docs/engine-spec.md §2.3
 *
 * 評価手法: 市場浸透モデル + DCF(主)。
 * 依存ゼロの純粋関数のみ。
 */
import { presentValue, presentValueOfTerminalValue, terminalValue } from '../common/npv.ts'
import type { EngineResult, Money, Range3, Ratio, SectorValuationResult, YearIndex } from '../types.ts'

export type DeviceClass = 'I' | 'II' | 'III' | 'IV'

export interface MedicalDeviceInputs {
  annualProcedures: number // 現在の年間対象手技数。≥ 0
  procedureGrowth: Ratio // 手技数の年次成長。> −1
  deviceClass: DeviceClass // 表示・診断用。計算式には不使用
  launchYear: YearIndex // 承認+保険償還完了→販売開始年
  approvalDelayYears: number // シナリオレバー。≥ 0。実効上市年 L = launchYear + delay
  pricePerProcedure: number // 手技あたりデバイス売上(償還価格ベース、円)
  peakPenetration: Ratio // 最大浸透率。[0, 1]
  yearsToPeak: number // 浸透ランプ年数(線形 → U-7)。≥ 1
  recurringRatio: Ratio // 総売上に占めるリカーリング比率。[0, 1)
  operatingMargin: Ratio // 定常営業利益率(チャネルコスト込み → U-8)
  discountRate: Range3<Ratio> // 悲観 = 高割引率
  projectionYears: number // 既定 10
  terminalGrowth: Ratio // 既定 0.02(仮値)
}

/**
 * 実効上市年 L = launchYear + approvalDelayYears
 *
 * Procedures(t) = annualProcedures × (1 + procedureGrowth)^t
 * Pen(t)        = 0                                        (t < L)
 *               = min(peakPenetration, peakPenetration × (t − L + 1) / yearsToPeak)   (t ≥ L)
 *
 * DeviceRev(t)  = Procedures(t) × Pen(t) × pricePerProcedure / 1e6      [百万円]
 * TotalRev(t)   = DeviceRev(t) / (1 − recurringRatio)
 * FCF(t)        = TotalRev(t) × operatingMargin
 * EV_k          = Σ_{t=1}^{T} FCF(t)/(1+r_k)^t + TV_T/(1+r_k)^T
 *
 * 境界条件: peakPenetration = 0 または annualProcedures = 0 ⇒ EV = 0。
 *          recurringRatio → 1 は ValidationIssue(発散)。
 */
export function evaluateMedicalDevice(inputs: MedicalDeviceInputs): EngineResult<SectorValuationResult> {
  if (inputs.recurringRatio >= 1) {
    return {
      ok: false,
      errors: [
        {
          field: 'recurringRatio',
          code: 'RECURRING_RATIO_DIVERGENT',
          message: 'recurringRatio は 1 未満である必要があります(売上が発散します)',
        },
      ],
    }
  }
  for (const key of ['pessimistic', 'base', 'optimistic'] as const) {
    if (inputs.discountRate[key] <= inputs.terminalGrowth) {
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
  }

  const L = inputs.launchYear + inputs.approvalDelayYears

  const computeAt = (rate: Ratio): { ev: Money; cashflows: { t: number; cf: Money }[] } => {
    const cashflows: { t: number; cf: Money }[] = []
    for (let t = 1; t <= inputs.projectionYears; t++) {
      const procedures = inputs.annualProcedures * Math.pow(1 + inputs.procedureGrowth, t)
      const pen = t >= L ? Math.min(inputs.peakPenetration, (inputs.peakPenetration * (t - L + 1)) / inputs.yearsToPeak) : 0
      const deviceRev = (procedures * pen * inputs.pricePerProcedure) / 1e6
      const totalRev = deviceRev / (1 - inputs.recurringRatio)
      const fcf = totalRev * inputs.operatingMargin
      cashflows.push({ t, cf: fcf })
    }
    const finalCf = cashflows.length > 0 ? cashflows[cashflows.length - 1].cf : 0
    const tvResult = terminalValue(finalCf, rate, inputs.terminalGrowth)
    const tv = tvResult.ok ? tvResult.value : 0
    const ev = presentValue(rate, cashflows) + presentValueOfTerminalValue(tv, rate, inputs.projectionYears)
    return { ev, cashflows }
  }

  const pess = computeAt(inputs.discountRate.pessimistic)
  const base = computeAt(inputs.discountRate.base)
  const opt = computeAt(inputs.discountRate.optimistic)

  return {
    ok: true,
    value: {
      ev: { pessimistic: pess.ev, base: base.ev, optimistic: opt.ev },
      keyMetrics: {},
      cashflows: base.cashflows,
    },
  }
}

export const MEDICAL_DEVICE_SENSITIVITY_DRIVERS = [
  'peakPenetration',
  'approvalDelayYears',
  'pricePerProcedure',
  'procedureGrowth',
] as const

export function applyMedicalDeviceDriver(
  inputs: MedicalDeviceInputs,
  driverId: string,
  multiplier: number,
): MedicalDeviceInputs {
  switch (driverId) {
    case 'peakPenetration': {
      const value = Math.min(Math.max(inputs.peakPenetration * multiplier, 0), 1)
      return { ...inputs, peakPenetration: value }
    }
    case 'approvalDelayYears': {
      const value = Math.max(inputs.approvalDelayYears * multiplier, 0)
      return { ...inputs, approvalDelayYears: value }
    }
    case 'pricePerProcedure': {
      const value = Math.max(inputs.pricePerProcedure * multiplier, 0)
      return { ...inputs, pricePerProcedure: value }
    }
    case 'procedureGrowth': {
      const value = Math.max(inputs.procedureGrowth * multiplier, -0.999)
      return { ...inputs, procedureGrowth: value }
    }
    default:
      return inputs
  }
}

export function medicalDeviceBaseEv(inputs: MedicalDeviceInputs): Money {
  const result = evaluateMedicalDevice(inputs)
  return result.ok ? result.value.ev.base : Number.NaN
}
