/**
 * 希薄化(資本政策シミュレーター)。
 * 出典: docs/engine-spec.md §1.4
 *
 * U-14(確定): Exit時、未消化プールは無視(失効)し、残余の保有者で按分し直す。
 * U-13(仮採用): 優先分配権(liquidation preference)は v1 では扱わない。
 *
 * 依存ゼロの純粋関数のみ。
 */
import type { Cashflow } from './npv.ts'
import { irrBisection, moic } from './npv.ts'
import { atLeast, collectIssues, inRange, nonNegativeInteger } from './validation.ts'
import type { Money, Ratio, ValidationIssue, YearIndex } from '../types.ts'

export interface CapTableHolder {
  id: string
  name: string
  ownership: Ratio // 初期持分。Σ = 1(未消化オプションプールも1保有者として含む)
  isPool?: boolean // オプションプール枠
  isFund?: boolean // 自ファンド(IRR/MOIC集計対象)
}

export interface FundingRound {
  name: string // 例: "シリーズA"
  yearIndex: YearIndex
  preMoneyValuation: Money // プレマネー(株式価値ベース)
  amountRaised: Money // ラウンド総調達額
  optionPoolPostPct: Ratio // ラウンド後の未消化プール目標比率。プレで組成(既存株主が負担)
  fundInvestment: Money // うち自ファンド出資額(0 ≤ x ≤ amountRaised)
}

export interface DilutionInputs {
  initialCapTable: CapTableHolder[]
  rounds: FundingRound[] // yearIndex 昇順(内部で昇順ソートし直す)
  exit: { yearIndex: YearIndex; equityValue: Money } // シナリオ評価結果と連動
}

export interface RoundSnapshot {
  round: FundingRound
  capTableAfter: CapTableHolder[]
}

export interface ExitHolderResult {
  id: string
  name: string
  effectiveOwnership: Ratio // 未消化プール失効後、残余保有者で再正規化した持分
  payout: Money
}

export interface DilutionResult {
  rounds: RoundSnapshot[]
  exitCapTable: ExitHolderResult[] // プール(isPool)は除外済み
  fundCashflows: Cashflow[]
  fundIrr: Ratio | null
  fundMoic: Money | null
}

/**
 * 1ラウンド分の資本政策更新。
 *
 * post = preMoneyValuation + amountRaised
 * n    = amountRaised / post
 * k    = (1 − n − p_tgt) / (1 − p_cur)
 * Δ    = p_tgt − p_cur × k
 * Δ < 0 のとき(既目標超過): Δ = 0, k = 1 − n
 */
function applyRound(capTable: CapTableHolder[], round: FundingRound, roundIndex: number): CapTableHolder[] {
  const post = round.preMoneyValuation + round.amountRaised
  const n = round.amountRaised / post
  const pTgt = round.optionPoolPostPct
  const poolIndex = capTable.findIndex((h) => h.isPool)
  const pCur = poolIndex >= 0 ? capTable[poolIndex].ownership : 0

  let k = (1 - n - pTgt) / (1 - pCur)
  let delta = pTgt - pCur * k
  if (delta < 0) {
    delta = 0
    k = 1 - n
  }

  const next: CapTableHolder[] = capTable.map((holder, idx) => {
    if (idx === poolIndex) {
      return { ...holder, ownership: pCur * k + delta }
    }
    return { ...holder, ownership: holder.ownership * k }
  })

  // 既存資本政策にプールが存在しない場合、目標プールを新規保有者として追加する。
  if (poolIndex < 0 && delta > 0) {
    next.push({ id: `pool-${roundIndex}`, name: `${round.name} オプションプール`, ownership: delta, isPool: true })
  }

  const fundOwnership = round.fundInvestment > 0 ? round.fundInvestment / post : 0
  const otherOwnership = n - fundOwnership
  if (fundOwnership > 0) {
    next.push({
      id: `${round.name}-fund-${roundIndex}`,
      name: `${round.name}(自ファンド)`,
      ownership: fundOwnership,
      isFund: true,
    })
  }
  if (otherOwnership > 0) {
    next.push({
      id: `${round.name}-others-${roundIndex}`,
      name: `${round.name}(その他投資家)`,
      ownership: otherOwnership,
    })
  }

  return next
}

/**
 * Exit時: 未消化プールは無視(失効)し、残余の保有者で按分し直す【U-14 確定】。
 *
 * p_pool         = Exit時点の未消化プール比率
 * Exit時実効持分 = ownership / (1 − p_pool)       // プール以外の各保有者。総和 = 1 に再正規化
 * ファンド手取り = ファンドのExit時実効持分 × exit.equityValue
 */
export function simulateDilution(inputs: DilutionInputs): DilutionResult {
  let capTable: CapTableHolder[] = inputs.initialCapTable.map((h) => ({ ...h }))
  const rounds: RoundSnapshot[] = []
  const fundCashflows: Cashflow[] = []

  const sortedRounds = [...inputs.rounds].sort((a, b) => a.yearIndex - b.yearIndex)
  sortedRounds.forEach((round, idx) => {
    capTable = applyRound(capTable, round, idx)
    rounds.push({ round, capTableAfter: capTable.map((h) => ({ ...h })) })
    if (round.fundInvestment > 0) {
      fundCashflows.push({ t: round.yearIndex, cf: -round.fundInvestment })
    }
  })

  const poolHolder = capTable.find((h) => h.isPool)
  const pPool = poolHolder ? poolHolder.ownership : 0
  const denom = 1 - pPool

  const exitCapTable: ExitHolderResult[] = capTable
    .filter((h) => !h.isPool)
    .map((h) => {
      const effectiveOwnership = denom > 0 ? h.ownership / denom : 0
      return {
        id: h.id,
        name: h.name,
        effectiveOwnership,
        payout: effectiveOwnership * inputs.exit.equityValue,
      }
    })

  const hasFund = capTable.some((h) => h.isFund)
  if (hasFund) {
    const fundIds = new Set(capTable.filter((h) => h.isFund).map((h) => h.id))
    const fundPayout = exitCapTable
      .filter((h) => fundIds.has(h.id))
      .reduce((sum, h) => sum + h.payout, 0)
    fundCashflows.push({ t: inputs.exit.yearIndex, cf: fundPayout })
  }

  return {
    rounds,
    exitCapTable,
    fundCashflows,
    fundIrr: irrBisection(fundCashflows),
    fundMoic: moic(fundCashflows),
  }
}

/**
 * DilutionInputs のドメイン検証(Phase 4追加、§4.5)。違反は全件列挙する(§0.2と同じ規約)。
 * `simulateDilution` 自体は従来どおり検証を行わない(呼び出し側が事前に検証する契約)。
 */
export function validateDilutionInputs(inputs: DilutionInputs): ValidationIssue[] {
  const checks: (ValidationIssue | null)[] = []

  inputs.initialCapTable.forEach((holder, i) => {
    checks.push(inRange(holder.ownership, `initialCapTable[${i}].ownership`, 0, 1))
  })
  const ownershipSum = inputs.initialCapTable.reduce((sum, h) => sum + h.ownership, 0)
  if (Math.abs(ownershipSum - 1) > 1e-9) {
    checks.push({
      field: 'initialCapTable',
      code: 'OWNERSHIP_SUM_NOT_ONE',
      message: `initialCapTable の ownership 合計は 1 である必要があります(実際: ${ownershipSum})`,
    })
  }
  const poolCount = inputs.initialCapTable.filter((h) => h.isPool).length
  if (poolCount > 1) {
    checks.push({
      field: 'initialCapTable',
      code: 'MULTIPLE_POOLS',
      message: `initialCapTable の isPool は高々1件である必要があります(実際: ${poolCount}件)`,
    })
  }

  inputs.rounds.forEach((round, i) => {
    const prefix = `rounds[${i}]`
    checks.push(atLeast(round.preMoneyValuation, `${prefix}.preMoneyValuation`, 0, { exclusive: true }))
    checks.push(atLeast(round.amountRaised, `${prefix}.amountRaised`, 0))
    checks.push(inRange(round.optionPoolPostPct, `${prefix}.optionPoolPostPct`, 0, 1, { maxExclusive: true }))
    checks.push(atLeast(round.fundInvestment, `${prefix}.fundInvestment`, 0))
    if (round.fundInvestment > round.amountRaised) {
      checks.push({
        field: `${prefix}.fundInvestment`,
        code: 'OUT_OF_DOMAIN',
        message: `${prefix}.fundInvestment は amountRaised 以下である必要があります(実際: ${round.fundInvestment} > ${round.amountRaised})`,
      })
    }
    checks.push(nonNegativeInteger(round.yearIndex, `${prefix}.yearIndex`))

    const post = round.preMoneyValuation + round.amountRaised
    if (post > 0) {
      const n = round.amountRaised / post
      if (n + round.optionPoolPostPct >= 1) {
        checks.push({
          field: `${prefix}.optionPoolPostPct`,
          code: 'DILUTION_COLLAPSE',
          message: `${prefix}: amountRaised/(preMoneyValuation+amountRaised) + optionPoolPostPct が1以上のため希釈係数が0以下になります`,
        })
      }
    }
  })

  const maxRoundYear = inputs.rounds.reduce((max, r) => Math.max(max, r.yearIndex), 0)
  if (inputs.exit.yearIndex < maxRoundYear) {
    checks.push({
      field: 'exit.yearIndex',
      code: 'OUT_OF_DOMAIN',
      message: `exit.yearIndex は全ラウンドのyearIndex以上である必要があります(実際: ${inputs.exit.yearIndex} < ${maxRoundYear})`,
    })
  }
  checks.push(atLeast(inputs.exit.equityValue, 'exit.equityValue', 0))

  return collectIssues(...checks)
}
