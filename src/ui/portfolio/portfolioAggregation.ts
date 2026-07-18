/**
 * 仮想ポートフォリオのファンド単位集計(純粋関数)。出典: docs/phase5-spec.md §3.3, §3.4
 *
 * IRR/MOICの式はエンジンの irrBisection / moic をそのまま呼ぶ(CLAUDE.mdエンジン変更規則。
 * UI側で式を複製しない)。日付(new Date())はこのモジュールの外(UI層)に閉じ、
 * 呼び出し側は評価基準日を ISO8601 文字列として渡す(P5-4裁定)。
 */
import { irrBisection } from '../../engine/index.ts'
import type { EngineResult, EvRange, Money, Ratio, SectorValuationResult } from '../../engine/index.ts'
import type { PortfolioHolding, Scenario } from '../../store/scenarioTypes.ts'
import { evaluateScenario } from '../scenarioEvaluation/evaluateScenario.ts'
import { buildHoldingCashflows } from './buildHoldingCashflows.ts'
import type { V2LinkedValuation } from './v2Linking.ts'

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000

/** 投資日→評価基準日の経過年数(小数年、負にはならないよう0でクランプ)。§3.3。 */
export function computeYearsElapsed(investmentDateIso: string, evalDateIso: string): number {
  const years = (new Date(evalDateIso).getTime() - new Date(investmentDateIso).getTime()) / MS_PER_YEAR
  return Math.max(0, years)
}

export interface HoldingValuation {
  holdingId: string
  /** 未紐付け・評価不能・シナリオ削除済みのとき true(P5-1裁定: 投資額で代替=コスト評価)。 */
  isCostBasis: boolean
  /** 時価3点。コスト評価時は3点とも investmentAmount と同値(P5-1)。 */
  marketValue: EvRange
  /** 時価_base / investmentAmount。investmentAmount <= 0 のときは null。 */
  moic: Money | null
  /** moicがnullの理由(画面・Excelとも「—(理由)」に統一する。§7表記統一、B-2)。 */
  moicUnavailableReason: string | null
  irr: Ratio | null
  irrUnavailableReason: string | null
}

function resolveEvaluation(scenario: Scenario | null): EngineResult<SectorValuationResult> | null {
  return scenario ? evaluateScenario(scenario) : null
}

/**
 * 銘柄1件の時価・MOIC・IRRを評価する。
 * linkedScenario は呼び出し側が holding.scenarioId から解決済みのものを渡す
 * (未紐付け・シナリオ削除済みはいずれも null。§3.1)。
 * v2Valuation は holding.v2CompanyId から解決済みのV2採用ケース評価(`resolveV2CompanyValuation`)。
 * holding.v2CompanyId が設定されている銘柄はこちらを優先する(R-V2-1: 単一値・3点レンジなし。
 * 採用ケース未選択・会社削除済み(v2Valuationがnull)はコスト評価にフォールバックする、既存P5-1と同じ規約)。
 */
export function evaluateHolding(
  holding: PortfolioHolding,
  linkedScenario: Scenario | null,
  evalDateIso: string,
  v2Valuation: V2LinkedValuation | null = null,
): HoldingValuation {
  if (holding.v2CompanyId) {
    const isCostBasis = v2Valuation === null
    const marketValue: EvRange = isCostBasis
      ? { pessimistic: holding.investmentAmount, base: holding.investmentAmount, optimistic: holding.investmentAmount }
      : (() => {
          const value = holding.ownershipPct * (v2Valuation as V2LinkedValuation).currentAllowablePostMoney
          return { pessimistic: value, base: value, optimistic: value }
        })()
    return evaluateHoldingFromMarketValue(holding, marketValue, isCostBasis, evalDateIso)
  }

  const evaluation = resolveEvaluation(linkedScenario)
  const isCostBasis = evaluation === null || !evaluation.ok
  const marketValue: EvRange = isCostBasis
    ? { pessimistic: holding.investmentAmount, base: holding.investmentAmount, optimistic: holding.investmentAmount }
    : {
        pessimistic: holding.ownershipPct * evaluation.value.ev.pessimistic,
        base: holding.ownershipPct * evaluation.value.ev.base,
        optimistic: holding.ownershipPct * evaluation.value.ev.optimistic,
      }
  return evaluateHoldingFromMarketValue(holding, marketValue, isCostBasis, evalDateIso)
}

function evaluateHoldingFromMarketValue(
  holding: PortfolioHolding,
  marketValue: EvRange,
  isCostBasis: boolean,
  evalDateIso: string,
): HoldingValuation {
  const moicValue = holding.investmentAmount > 0 ? marketValue.base / holding.investmentAmount : null
  const moicUnavailableReason = moicValue === null ? '投資額が0以下' : null

  if (holding.investmentDate === null) {
    return {
      holdingId: holding.id,
      isCostBasis,
      marketValue,
      moic: moicValue,
      moicUnavailableReason,
      irr: null,
      irrUnavailableReason: '投資日未設定',
    }
  }
  const t = computeYearsElapsed(holding.investmentDate, evalDateIso)
  if (t <= 0) {
    return {
      holdingId: holding.id,
      isCostBasis,
      marketValue,
      moic: moicValue,
      moicUnavailableReason,
      irr: null,
      irrUnavailableReason: '当日投資のため未定義',
    }
  }
  const irr = irrBisection(buildHoldingCashflows(holding.investmentAmount, marketValue.base, t))
  return {
    holdingId: holding.id,
    isCostBasis,
    marketValue,
    moic: moicValue,
    moicUnavailableReason,
    irr,
    irrUnavailableReason: irr === null ? '算出不能' : null,
  }
}

export interface FundSummary {
  totalMarketValue: EvRange
  totalInvestment: Money
  fundMoic: Money | null
  fundMoicUnavailableReason: string | null
  fundIrr: Ratio | null
  fundIrrUnavailableReason: string | null
  /** 集計にコスト評価銘柄が1件以上含まれるか(時価総額の注記に使用、§3.4)。 */
  hasCostBasisHoldings: boolean
}

/**
 * ファンド単位集計(§3.4)。時価総額は3点、IRR/MOICはベース基準のみ(P5-9裁定)。
 * scenarioById は呼び出し側(UI層のstore)が解決済みのシナリオ辞書を渡す。
 * v2ValuationByCompanyId は呼び出し側が `buildV2ValuationMap` で解決済みのV2会社評価辞書を渡す
 * (省略時はV2連動銘柄も全てコスト評価にフォールバックする)。
 */
export function aggregatePortfolio(
  holdings: PortfolioHolding[],
  scenarioById: Map<string, Scenario>,
  evalDateIso: string,
  v2ValuationByCompanyId: Map<string, V2LinkedValuation | null> = new Map(),
): FundSummary {
  const valuations = holdings.map((h) =>
    evaluateHolding(
      h,
      h.scenarioId ? (scenarioById.get(h.scenarioId) ?? null) : null,
      evalDateIso,
      h.v2CompanyId ? (v2ValuationByCompanyId.get(h.v2CompanyId) ?? null) : null,
    ),
  )

  const totalMarketValue: EvRange = {
    pessimistic: valuations.reduce((sum, v) => sum + v.marketValue.pessimistic, 0),
    base: valuations.reduce((sum, v) => sum + v.marketValue.base, 0),
    optimistic: valuations.reduce((sum, v) => sum + v.marketValue.optimistic, 0),
  }
  const totalInvestment = holdings.reduce((sum, h) => sum + h.investmentAmount, 0)
  const fundMoic = totalInvestment > 0 ? totalMarketValue.base / totalInvestment : null
  const fundMoicUnavailableReason =
    fundMoic !== null ? null : holdings.length === 0 ? '銘柄がありません' : '投資額合計が0以下'
  const hasCostBasisHoldings = valuations.some((v) => v.isCostBasis)

  if (holdings.length === 0) {
    return {
      totalMarketValue,
      totalInvestment,
      fundMoic,
      fundMoicUnavailableReason,
      fundIrr: null,
      fundIrrUnavailableReason: '銘柄がありません',
      hasCostBasisHoldings,
    }
  }

  const hasMissingInvestmentDate = holdings.some((h) => h.investmentDate === null)
  if (hasMissingInvestmentDate) {
    return {
      totalMarketValue,
      totalInvestment,
      fundMoic,
      fundMoicUnavailableReason,
      fundIrr: null,
      fundIrrUnavailableReason: '投資日未設定の銘柄があります',
      hasCostBasisHoldings,
    }
  }

  const allCashflows = holdings.flatMap((h, i) => {
    const t = computeYearsElapsed(h.investmentDate as string, evalDateIso)
    return buildHoldingCashflows(h.investmentAmount, valuations[i].marketValue.base, t)
  })
  const fundIrr = irrBisection(allCashflows)
  return {
    totalMarketValue,
    totalInvestment,
    fundMoic,
    fundMoicUnavailableReason,
    fundIrr,
    fundIrrUnavailableReason: fundIrr === null ? '算出不能' : null,
    hasCostBasisHoldings,
  }
}
