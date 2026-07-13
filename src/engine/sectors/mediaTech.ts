/**
 * メディアテック。
 * 出典: docs/engine-spec.md §2.4
 *
 * 評価手法: EV/売上マルチプル + ユーザーエコノミクス(診断)。
 * 依存ゼロの純粋関数のみ。
 */
import { atLeast, collectIssues, inRange, positiveInteger } from '../common/validation.ts'
import type { EngineResult, Money, Range3, Ratio, SectorValuationResult, Yen } from '../types.ts'

export interface MediaTechInputs {
  mau: number // 現在MAU。≥ 0
  mauGrowth: Ratio // 年次成長率。> −1(獲得-解約の構造化はしない → U-9)
  growthDecayFactor: Ratio // 既定 0.85(仮値)
  dauMauRatio: Ratio // [0, 1]。対比指標
  arpuMonthly: { ad: Yen; paid: Yen; commerce: Yen } // 月次ARPU構成。各 ≥ 0
  monthlyChurn: Ratio // 月次解約率。[0, 1]。継続率カーブの代表値
  contentCostRatio: Ratio // コンテンツ原価率。[0, 1]
  cpa: Yen // 顧客獲得単価。≥ 0
  evSalesMultiple: Range3<number> // 各値 > 0
  projectionYears: number // 売上予測表示用。既定 3
}

/**
 * ARPU_total   = arpuMonthly.ad + arpuMonthly.paid + arpuMonthly.commerce   [円/月]
 * MAU(t)       = MAU(t−1) × (1 + g_t),  g_t = mauGrowth × growthDecayFactor^(t−1)
 * Revenue(t)   = MAU(t) × ARPU_total × 12 / 1e6                             [百万円]
 * EV_k = Revenue(1) × evSalesMultiple_k        // NTM売上基準
 *
 * ユーザーエコノミクス(keyMetrics、monthlyChurn > 0 のときのみ算出):
 * avgLifetimeMonths = 1 / monthlyChurn
 * LTV               = ARPU_total × (1 − contentCostRatio) × avgLifetimeMonths   [円]
 * ltvCpaRatio       = LTV / cpa                            (cpa > 0 のときのみ)
 * paybackMonths     = cpa / (ARPU_total × (1 − contentCostRatio))
 *
 * 境界条件: mau = 0 ⇒ EV = 0。monthlyChurn = 0 ⇒ LTV系指標は省略(§0.2)。
 */

/**
 * 月次解約率一定を仮定したnヶ月後残存率 = (1 − monthlyChurn)^n。
 * UI側での複製実装を避けるための公開ヘルパー(D-9/B-3。定義: docs/requirements-rev5.md §6.1)。
 * keyMetricsには含めない(含めるとgolden fixtureの出力が変わり再生成が必要になるため)。
 */
export function retentionAfterMonths(monthlyChurn: Ratio, months: number): Ratio {
  return Math.pow(1 - monthlyChurn, months)
}

export function evaluateMediaTech(inputs: MediaTechInputs): EngineResult<SectorValuationResult> {
  const issues = collectIssues(
    atLeast(inputs.mau, 'mau', 0),
    atLeast(inputs.mauGrowth, 'mauGrowth', -1, { exclusive: true }),
    inRange(inputs.growthDecayFactor, 'growthDecayFactor', 0, 1, { minExclusive: true }),
    inRange(inputs.dauMauRatio, 'dauMauRatio', 0, 1),
    atLeast(inputs.arpuMonthly.ad, 'arpuMonthly.ad', 0),
    atLeast(inputs.arpuMonthly.paid, 'arpuMonthly.paid', 0),
    atLeast(inputs.arpuMonthly.commerce, 'arpuMonthly.commerce', 0),
    inRange(inputs.monthlyChurn, 'monthlyChurn', 0, 1),
    inRange(inputs.contentCostRatio, 'contentCostRatio', 0, 1),
    atLeast(inputs.cpa, 'cpa', 0),
    atLeast(inputs.evSalesMultiple.pessimistic, 'evSalesMultiple.pessimistic', 0, { exclusive: true }),
    atLeast(inputs.evSalesMultiple.base, 'evSalesMultiple.base', 0, { exclusive: true }),
    atLeast(inputs.evSalesMultiple.optimistic, 'evSalesMultiple.optimistic', 0, { exclusive: true }),
    positiveInteger(inputs.projectionYears, 'projectionYears'),
  )
  if (issues.length > 0) return { ok: false, errors: issues }

  const arpuTotal = inputs.arpuMonthly.ad + inputs.arpuMonthly.paid + inputs.arpuMonthly.commerce

  let mau = inputs.mau
  const mauSeries: number[] = []
  for (let t = 1; t <= inputs.projectionYears; t++) {
    const g = inputs.mauGrowth * Math.pow(inputs.growthDecayFactor, t - 1)
    mau = mau * (1 + g)
    mauSeries.push(mau)
  }
  const revenue1 = ((mauSeries[0] ?? 0) * arpuTotal * 12) / 1e6

  const ev = {
    pessimistic: revenue1 * inputs.evSalesMultiple.pessimistic,
    base: revenue1 * inputs.evSalesMultiple.base,
    optimistic: revenue1 * inputs.evSalesMultiple.optimistic,
  }

  const keyMetrics: Record<string, number> = {}
  if (inputs.monthlyChurn > 0) {
    const avgLifetimeMonths = 1 / inputs.monthlyChurn
    const netArpu = arpuTotal * (1 - inputs.contentCostRatio)
    const ltv = netArpu * avgLifetimeMonths
    keyMetrics.avgLifetimeMonths = avgLifetimeMonths
    keyMetrics.ltv = ltv
    if (inputs.cpa > 0) {
      keyMetrics.ltvCpaRatio = ltv / inputs.cpa
    }
    if (netArpu > 0) {
      keyMetrics.paybackMonths = inputs.cpa / netArpu
    }
  }

  return { ok: true, value: { ev, keyMetrics } }
}

export const MEDIA_TECH_SENSITIVITY_DRIVERS = ['mauGrowth', 'evSalesMultiple.base', 'monthlyChurn', 'cpa'] as const

export function applyMediaTechDriver(inputs: MediaTechInputs, driverId: string, multiplier: number): MediaTechInputs {
  switch (driverId) {
    case 'mauGrowth': {
      const value = Math.max(inputs.mauGrowth * multiplier, -0.999)
      return { ...inputs, mauGrowth: value }
    }
    case 'evSalesMultiple.base': {
      const value = Math.max(inputs.evSalesMultiple.base * multiplier, 1e-9)
      return { ...inputs, evSalesMultiple: { ...inputs.evSalesMultiple, base: value } }
    }
    case 'monthlyChurn': {
      const value = Math.min(Math.max(inputs.monthlyChurn * multiplier, 0), 1)
      return { ...inputs, monthlyChurn: value }
    }
    case 'cpa': {
      const value = Math.max(inputs.cpa * multiplier, 0)
      return { ...inputs, cpa: value }
    }
    default:
      return inputs
  }
}

export function mediaTechBaseEv(inputs: MediaTechInputs): Money {
  const result = evaluateMediaTech(inputs)
  return result.ok ? result.value.ev.base : Number.NaN
}
