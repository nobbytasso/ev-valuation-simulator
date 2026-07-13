/**
 * クライメートテック。
 * 出典: docs/engine-spec.md §2.6
 *
 * 評価手法: プロジェクトDCF(CAPEX重視)+ マイルストーン(量産化)到達確率によるリスク調整。
 * 依存ゼロの純粋関数のみ。
 */
import { atLeast, collectIssues, inRange, positiveInteger } from '../common/validation.ts'
import type { EngineResult, Money, Range3, Ratio, SectorValuationResult, Yen, YearIndex } from '../types.ts'

export interface ClimateTechInputs {
  capexSchedule: { yearIndex: YearIndex; amount: Money }[] // 正の値で入力
  subsidyCoverage: Ratio // CAPEXのうち補助金で賄われる比率。[0, 1]。シナリオレバー
  massProductionYear: YearIndex // 量産化マイルストーン年 m
  massProductionProb: Ratio // 量産化到達確率 P。[0, 1]
  annualCapacityUnits: number // 量産後の年間生産能力。≥ 0
  rampYears: number // 量産開始→フル稼働の年数(線形)。≥ 1
  unitPrice: Yen // 販売単価
  unitCost0: Yen // 現在のユニットコスト
  costDeclineRate: Ratio // ユニットコスト年次低減率。[0, 1)
  offtakeCoverage: Ratio // オフテイク契約カバー率。[0, 1]。対比・診断+実現率に使用
  merchantRealization: Ratio // 非オフテイク分の販売実現率。既定 1(仮値 → U-11)
  fixedOpexAnnual: Money // 量産後の年間固定費
  carbonCreditVolume: number // t-CO2/年(量産後)
  carbonCreditPrice: Yen // 円/t-CO2。感度分析の主要対象
  discountRate: Range3<Ratio> // 悲観 = 高割引率
  projectYears: number // プロジェクト評価年数(t=0起点)。既定 20
}

/**
 * m = massProductionYear、P = massProductionProb
 *
 * Volume(t)   = 0                                             (t < m)
 *             = annualCapacityUnits × min(1, (t − m + 1) / rampYears)
 *               × (offtakeCoverage + (1 − offtakeCoverage) × merchantRealization)
 * UnitCost(t) = unitCost0 × (1 − costDeclineRate)^t
 * UnitMargin(t) = (unitPrice − UnitCost(t)) / 1e6              [百万円/unit。負も許容]
 *
 * OpCF(t)     = Volume(t) × UnitMargin(t)
 *               + carbonCreditVolume × carbonCreditPrice / 1e6    (t ≥ m)
 *               − fixedOpexAnnual                                  (t ≥ m)
 * NetCapex(t) = capexSchedule(t) × (1 − subsidyCoverage)
 *
 * リスク調整: t < m のCF(主に初期CAPEX)は確率調整なし(コミット済み)、
 *             t ≥ m のCF(OpCF・以降のCAPEX)は × P
 *
 * EV_k = Σ_{t < m} −NetCapex(t)/(1+r_k)^t
 *      + P × Σ_{t ≥ m} [OpCF(t) − NetCapex(t)] /(1+r_k)^t
 *
 * 評価期間は t = 0..projectYears(両端含む)。ターミナルバリューなし(有限プロジェクト期間)。
 * 境界条件: P = 1 ⇒ 通常のプロジェクトNPVと一致。EVは負を許容(UIで警告)。
 */
export function evaluateClimateTech(inputs: ClimateTechInputs): EngineResult<SectorValuationResult> {
  const issues = [
    ...collectIssues(
      inRange(inputs.subsidyCoverage, 'subsidyCoverage', 0, 1),
      inRange(inputs.massProductionProb, 'massProductionProb', 0, 1),
      atLeast(inputs.annualCapacityUnits, 'annualCapacityUnits', 0),
      positiveInteger(inputs.rampYears, 'rampYears'),
      atLeast(inputs.unitPrice, 'unitPrice', 0),
      atLeast(inputs.unitCost0, 'unitCost0', 0),
      inRange(inputs.costDeclineRate, 'costDeclineRate', 0, 1, { maxExclusive: true }),
      inRange(inputs.offtakeCoverage, 'offtakeCoverage', 0, 1),
      inRange(inputs.merchantRealization, 'merchantRealization', 0, 1),
      atLeast(inputs.fixedOpexAnnual, 'fixedOpexAnnual', 0),
      atLeast(inputs.carbonCreditVolume, 'carbonCreditVolume', 0),
      atLeast(inputs.carbonCreditPrice, 'carbonCreditPrice', 0),
      atLeast(inputs.discountRate.pessimistic, 'discountRate.pessimistic', 0, { exclusive: true }),
      atLeast(inputs.discountRate.base, 'discountRate.base', 0, { exclusive: true }),
      atLeast(inputs.discountRate.optimistic, 'discountRate.optimistic', 0, { exclusive: true }),
      positiveInteger(inputs.projectYears, 'projectYears'),
    ),
    ...inputs.capexSchedule.flatMap((entry, i) => {
      const issue = atLeast(entry.amount, `capexSchedule[${i}].amount`, 0)
      return issue ? [issue] : []
    }),
  ]
  if (issues.length > 0) return { ok: false, errors: issues }

  const capexByYear = new Map<number, number>()
  for (const entry of inputs.capexSchedule) {
    capexByYear.set(entry.yearIndex, (capexByYear.get(entry.yearIndex) ?? 0) + entry.amount)
  }

  const m = inputs.massProductionYear
  const p = inputs.massProductionProb

  const volumeAt = (t: number): number => {
    if (t < m) return 0
    const ramp = Math.min(1, (t - m + 1) / inputs.rampYears)
    return (
      inputs.annualCapacityUnits *
      ramp *
      (inputs.offtakeCoverage + (1 - inputs.offtakeCoverage) * inputs.merchantRealization)
    )
  }
  const unitCostAt = (t: number): number => inputs.unitCost0 * Math.pow(1 - inputs.costDeclineRate, t)
  const unitMarginAt = (t: number): number => (inputs.unitPrice - unitCostAt(t)) / 1e6

  const computeAt = (rate: Ratio): { ev: Money; cashflows: { t: number; cf: Money }[] } => {
    const cashflows: { t: number; cf: Money }[] = []
    let npv = 0
    for (let t = 0; t <= inputs.projectYears; t++) {
      const capexAmount = capexByYear.get(t) ?? 0
      const netCapex = capexAmount * (1 - inputs.subsidyCoverage)
      let cf: number
      if (t < m) {
        cf = -netCapex
      } else {
        const carbonRevenue = (inputs.carbonCreditVolume * inputs.carbonCreditPrice) / 1e6
        const opCf = volumeAt(t) * unitMarginAt(t) + carbonRevenue - inputs.fixedOpexAnnual
        cf = p * (opCf - netCapex)
      }
      cashflows.push({ t, cf })
      npv += cf / Math.pow(1 + rate, t)
    }
    return { ev: npv, cashflows }
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

export const CLIMATE_TECH_SENSITIVITY_DRIVERS = [
  'massProductionProb',
  'subsidyCoverage',
  'carbonCreditPrice',
  'unitPrice',
] as const

export function applyClimateTechDriver(
  inputs: ClimateTechInputs,
  driverId: string,
  multiplier: number,
): ClimateTechInputs {
  switch (driverId) {
    case 'massProductionProb': {
      const value = Math.min(Math.max(inputs.massProductionProb * multiplier, 0), 1)
      return { ...inputs, massProductionProb: value }
    }
    case 'subsidyCoverage': {
      const value = Math.min(Math.max(inputs.subsidyCoverage * multiplier, 0), 1)
      return { ...inputs, subsidyCoverage: value }
    }
    case 'carbonCreditPrice': {
      const value = Math.max(inputs.carbonCreditPrice * multiplier, 0)
      return { ...inputs, carbonCreditPrice: value }
    }
    case 'unitPrice': {
      const value = Math.max(inputs.unitPrice * multiplier, 0)
      return { ...inputs, unitPrice: value }
    }
    default:
      return inputs
  }
}

export function climateTechBaseEv(inputs: ClimateTechInputs): Money {
  const result = evaluateClimateTech(inputs)
  return result.ok ? result.value.ev.base : Number.NaN
}
