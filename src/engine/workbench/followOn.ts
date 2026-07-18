/**
 * V2 Investment Case Workbench: 追加出資を含む投資家リターン計算。
 * 出典: docs/v2-adoption-spec.md §6.2、docs/engine-spec.md §5.5
 *
 * 依存ゼロの純粋関数。`buildWorkbenchCaseResult` が返す `exitEquityValue` を入力として受け取る
 * (Valuation Bridgeとは独立に、初回投資+追加出資トランシェの合算リターンを計算する)。
 *
 * ```text
 * 初回:        e_0 = investmentAmount / (proposedPreMoney + investmentAmount)
 * 追加出資 i:  e_i = amount_i / postMoney_i
 * Exit持分   = (Σ e_i) × dilutionRetention
 * 回収       = max(0, exitEquityValue) × Exit持分
 * MOIC       = 回収 / Σ amount
 * IRR        = irrBisection([(0, −初回), (yearOffset_i, −amount_i)…, (yearsToExit, +回収)])
 * ```
 */
import { irrBisection } from '../common/npv.ts'
import type { Cashflow } from '../common/npv.ts'
import type { Money, Ratio } from '../types.ts'
import type {
  WorkbenchFollowOnInput,
  WorkbenchFollowOnResult,
  WorkbenchFollowOnTrancheResult,
} from './types.ts'

export interface WorkbenchFollowOnCoreInputs {
  investmentAmount: Money
  proposedPreMoney: Money
  yearsToExit: number
  dilutionRetention: Ratio
}

export function computeFollowOnReturn(
  core: WorkbenchFollowOnCoreInputs,
  followOns: WorkbenchFollowOnInput[],
  exitEquityValue: Money,
): WorkbenchFollowOnResult {
  const proposedPostMoney = core.proposedPreMoney + core.investmentAmount
  const initialOwnershipShare: Ratio = proposedPostMoney > 0 ? core.investmentAmount / proposedPostMoney : 0

  let previousPostMoney = proposedPostMoney
  const tranches: WorkbenchFollowOnTrancheResult[] = followOns.map((item) => {
    const ownershipShare: Ratio = item.postMoney > 0 ? item.amount / item.postMoney : 0
    const multipleOfPreviousPostMoney = previousPostMoney > 0 ? item.postMoney / previousPostMoney : null
    previousPostMoney = item.postMoney
    return {
      label: item.label,
      yearOffset: item.yearOffset,
      amount: item.amount,
      postMoney: item.postMoney,
      ownershipShare,
      multipleOfPreviousPostMoney,
    }
  })

  const totalOwnershipShare: Ratio =
    initialOwnershipShare + tranches.reduce((sum, item) => sum + item.ownershipShare, 0)
  const exitOwnershipShare: Ratio = totalOwnershipShare * core.dilutionRetention
  const proceeds: Money = Math.max(0, exitEquityValue) * exitOwnershipShare
  const totalInvested: Money = core.investmentAmount + followOns.reduce((sum, item) => sum + item.amount, 0)
  const moic = totalInvested > 0 ? proceeds / totalInvested : null

  const cashflows: Cashflow[] = [
    { t: 0, cf: -core.investmentAmount },
    ...followOns.map((item): Cashflow => ({ t: item.yearOffset, cf: -item.amount })),
    { t: core.yearsToExit, cf: proceeds },
  ]
  const irr = irrBisection(cashflows)

  const warnings: string[] = []
  if (totalOwnershipShare > 1) warnings.push('追加出資を含む持分合計が100%を超えています。')

  return {
    tranches,
    initialOwnershipShare,
    totalOwnershipShare,
    exitOwnershipShare,
    totalInvested,
    proceeds,
    moic,
    irr,
    warnings,
    cashflows,
  }
}

/** Exit回収額の構成(docs/v2-adoption-spec.md §6.3、R-V2-3)。 */
export interface FollowOnProceedsComposition {
  /** 回収 ≥ 投資のとき'return'(投下資本回収分+超過リターン分)、回収 < 投資のとき'shortfall'(回収+元本毀損分)。 */
  kind: 'return' | 'shortfall'
  /** 投下資本の回収分(kind='return')、または回収そのもの(kind='shortfall')。 */
  recoveredPrincipal: Money
  /** 超過リターン分(kind='return'のときのみ正、それ以外0)。 */
  excessReturn: Money
  /** 元本毀損分(kind='shortfall'のときのみ正、それ以外0)。 */
  principalLoss: Money
}

/**
 * 回収額(`proceeds`)と投下資本合計(`totalInvested`)から、円チャート表示用の内訳を導出する
 * (R-V2-3採用推奨: 回収 ≥ 投資 → 「投下資本の回収分」+「超過リターン分」、
 * 回収 < 投資 → 「回収」+「元本毀損分」)。新しい金額計算は行わず、`computeFollowOnReturn` が
 * 既に算出した2値の表示用分解のみを行う純粋関数。
 */
export function composeFollowOnProceeds(proceeds: Money, totalInvested: Money): FollowOnProceedsComposition {
  if (totalInvested > 0 && proceeds < totalInvested) {
    return { kind: 'shortfall', recoveredPrincipal: proceeds, excessReturn: 0, principalLoss: totalInvested - proceeds }
  }
  return { kind: 'return', recoveredPrincipal: totalInvested, excessReturn: proceeds - totalInvested, principalLoss: 0 }
}
