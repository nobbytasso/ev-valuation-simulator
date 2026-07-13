/**
 * 現在価値(PV/NPV)・ターミナルバリュー・IRR/MOIC。
 * 出典: docs/engine-spec.md §0.4, §1.1, §1.3
 *
 * 依存ゼロの純粋関数のみ。
 */
import type { EngineResult, Money, Ratio, YearIndex } from '../types.ts'

export interface Cashflow {
  t: YearIndex
  cf: Money
}

/**
 * NPV(r, CF) = Σ_{t=0}^{T} CF_t / (1 + r)^t
 * 総和の演算順序は t 昇順で統一する(§0.4)。
 */
export function presentValue(rate: Ratio, cashflows: Cashflow[]): Money {
  const sorted = [...cashflows].sort((a, b) => a.t - b.t)
  let total = 0
  for (const { t, cf } of sorted) {
    total += cf / Math.pow(1 + rate, t)
  }
  return total
}

/**
 * ターミナルバリュー(Gordon成長モデル)。
 * TV_T = CF_T × (1 + g_term) / (r − g_term)      (r > g_term を要求。違反は ValidationIssue)
 */
export function terminalValue(finalCf: Money, rate: Ratio, terminalGrowth: Ratio): EngineResult<Money> {
  if (rate <= terminalGrowth) {
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
  return { ok: true, value: (finalCf * (1 + terminalGrowth)) / (rate - terminalGrowth) }
}

/** PV(TV) = TV_T / (1 + r)^T */
export function presentValueOfTerminalValue(tv: Money, rate: Ratio, atYear: YearIndex): Money {
  return tv / Math.pow(1 + rate, atYear)
}

const IRR_LOWER_BOUND = -0.9999
const IRR_UPPER_BOUND = 10.0
const IRR_TOLERANCE = 1e-12
const IRR_MAX_ITERATIONS = 200

/**
 * IRR: 投資家キャッシュフロー列に対し Σ CF_i / (1 + r)^{t_i} = 0 となる r を二分法で求める。
 * 探索区間 (-0.9999, 10.0]、収束判定 |f(r)| < 1e-12 または反復200回で打ち切り(§0.4)。
 *
 * 負のCFと正のCFの両方が存在しない場合、または区間内で符号変化がない場合は null を返す。
 */
export function irrBisection(cashflows: Cashflow[]): Ratio | null {
  const sorted = [...cashflows].sort((a, b) => a.t - b.t)
  const hasPos = sorted.some((c) => c.cf > 0)
  const hasNeg = sorted.some((c) => c.cf < 0)
  if (!hasPos || !hasNeg) return null

  const f = (rate: number): number =>
    sorted.reduce((acc, { t, cf }) => acc + cf / Math.pow(1 + rate, t), 0)

  let lo = IRR_LOWER_BOUND
  let hi = IRR_UPPER_BOUND
  let flo = f(lo)
  let fhi = f(hi)

  if (Math.abs(flo) < IRR_TOLERANCE) return lo
  if (Math.abs(fhi) < IRR_TOLERANCE) return hi
  if ((flo > 0 && fhi > 0) || (flo < 0 && fhi < 0)) return null

  let mid = (lo + hi) / 2
  for (let i = 0; i < IRR_MAX_ITERATIONS; i++) {
    mid = (lo + hi) / 2
    const fmid = f(mid)
    if (Math.abs(fmid) < IRR_TOLERANCE) return mid
    if (flo > 0 === fmid > 0) {
      lo = mid
      flo = fmid
    } else {
      hi = mid
      fhi = fmid
    }
  }
  return mid
}

/**
 * 単一投資・単一回収の閉形式 IRR = (回収額/投資額)^(1/t) − 1。
 * 二分法と同値(golden で両方検証)。
 */
export function irrClosedFormSingle(investment: Money, exitAmount: Money, years: number): Ratio | null {
  if (investment <= 0 || years <= 0) return null
  return Math.pow(exitAmount / investment, 1 / years) - 1
}

/**
 * MOIC = Σ(正のCF) / Σ(負のCFの絶対値)          (割引なし)
 * 負のCFが存在しない場合(投資額が定義できない)は null を返す。
 */
export function moic(cashflows: Cashflow[]): Money | null {
  let pos = 0
  let negAbs = 0
  const sorted = [...cashflows].sort((a, b) => a.t - b.t)
  for (const { cf } of sorted) {
    if (cf > 0) pos += cf
    else if (cf < 0) negAbs += -cf
  }
  if (negAbs === 0) return null
  return pos / negAbs
}
