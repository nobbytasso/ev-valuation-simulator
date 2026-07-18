import { describe, expect, it } from 'vitest'
import { createScenario } from '../../store/defaultInputs.ts'
import type { PortfolioHolding, Scenario } from '../../store/scenarioTypes.ts'
import { aggregatePortfolio, computeYearsElapsed, evaluateHolding } from './portfolioAggregation.ts'
import type { V2LinkedValuation } from './v2Linking.ts'

const EVAL_DATE = '2026-07-14T00:00:00.000Z'

function makeHolding(overrides: Partial<PortfolioHolding> = {}): PortfolioHolding {
  return {
    id: 'holding-1',
    companyName: 'テスト株式会社',
    sector: 'saas_jp',
    investmentAmount: 300,
    round: 'シリーズA',
    ownershipPct: 0.1,
    scenarioId: undefined,
    investmentDate: '2025-07-14', // ちょうど1年前
    schemaVersion: 2,
    createdAt: EVAL_DATE,
    updatedAt: EVAL_DATE,
    ...overrides,
  }
}

describe('computeYearsElapsed', () => {
  it('365.25日を1年として換算する(§3.3、engine-spec §0.1の実数年許容)', () => {
    const years = computeYearsElapsed('2025-07-14', EVAL_DATE)
    expect(years).toBeCloseTo(1, 2)
  })

  it('未来日(投資日 > 評価基準日)は0にクランプする', () => {
    const years = computeYearsElapsed('2027-01-01', EVAL_DATE)
    expect(years).toBe(0)
  })
})

describe('evaluateHolding(コスト評価分岐、P5-1裁定)', () => {
  it('未紐付け(scenarioId未設定)の銘柄は投資額をそのまま時価とするコスト評価になる', () => {
    const holding = makeHolding()
    const result = evaluateHolding(holding, null, EVAL_DATE)
    expect(result.isCostBasis).toBe(true)
    expect(result.marketValue).toEqual({ pessimistic: 300, base: 300, optimistic: 300 })
    expect(result.moic).toBeCloseTo(1, 9)
  })

  it('紐付いたシナリオが評価不能(ok:false)なときもコスト評価になる', () => {
    const scenario = createScenario('saas_jp', 'Broken') as Extract<Scenario, { sector: 'saas_jp' }>
    scenario.inputs.discountRate = 0.01
    scenario.inputs.terminalGrowth = 0.02 // r <= terminalGrowth はValidationIssue(engine-spec §1.1)
    const holding = makeHolding({ scenarioId: scenario.id })
    const result = evaluateHolding(holding, scenario, EVAL_DATE)
    expect(result.isCostBasis).toBe(true)
    expect(result.marketValue.base).toBe(300)
  })

  it('シナリオ削除済み(linkedScenario=null、scenarioIdは残存)もコスト評価になる', () => {
    const holding = makeHolding({ scenarioId: 'deleted-scenario-id' })
    const result = evaluateHolding(holding, null, EVAL_DATE)
    expect(result.isCostBasis).toBe(true)
  })

  it('正常に評価できるシナリオに紐付いた銘柄は EV×持分 を時価とする(P5-2裁定)', () => {
    const scenario = createScenario('saas_jp', 'OK') as Extract<Scenario, { sector: 'saas_jp' }>
    const holding = makeHolding({ scenarioId: scenario.id, ownershipPct: 0.1 })
    const result = evaluateHolding(holding, scenario, EVAL_DATE)
    expect(result.isCostBasis).toBe(false)
    // SaaSデフォルト: arr=1000, arrGrowth=0.3, evArrMultiple.base=8 → ARR_ntm=1300, EV_base=10400
    expect(result.marketValue.base).toBeCloseTo(1040, 6) // 10400 * 0.1
    expect(result.moic).toBeCloseTo(1040 / 300, 9)
  })

  it('investmentDateがnullのときIRRは「—(投資日未設定)」相当を返す(P5-3裁定)', () => {
    const holding = makeHolding({ investmentDate: null })
    const result = evaluateHolding(holding, null, EVAL_DATE)
    expect(result.irr).toBeNull()
    expect(result.irrUnavailableReason).toBe('投資日未設定')
  })

  it('投資日=評価基準日(t=0)のときIRRは未定義として「—」を返す', () => {
    const holding = makeHolding({ investmentDate: EVAL_DATE })
    const result = evaluateHolding(holding, null, EVAL_DATE)
    expect(result.irr).toBeNull()
    expect(result.irrUnavailableReason).toBe('当日投資のため未定義')
  })

  it('投資日が1年前・時価が投資額を上回る正常系ではIRRが数値で返る', () => {
    const scenario = createScenario('saas_jp', 'OK') as Extract<Scenario, { sector: 'saas_jp' }>
    const holding = makeHolding({ scenarioId: scenario.id, investmentDate: '2025-07-14' })
    const result = evaluateHolding(holding, scenario, EVAL_DATE)
    expect(result.irr).not.toBeNull()
    expect(result.irrUnavailableReason).toBeNull()
  })
})

describe('evaluateHolding(V2連動、R-V2-1)', () => {
  const v2Valuation: V2LinkedValuation = {
    companyId: 'company-1',
    companyName: 'V2株式会社',
    currentAllowablePostMoney: 4000,
  }

  it('V2会社に紐付き採用ケースがある銘柄は currentAllowablePostMoney × ownershipPct を単一値の時価とする', () => {
    const holding = makeHolding({ scenarioId: undefined, v2CompanyId: 'company-1', ownershipPct: 0.2 })
    const result = evaluateHolding(holding, null, EVAL_DATE, v2Valuation)
    expect(result.isCostBasis).toBe(false)
    expect(result.marketValue).toEqual({ pessimistic: 800, base: 800, optimistic: 800 })
  })

  it('V2会社に紐付くが採用ケース未選択(v2Valuation=null)のときはコスト評価にフォールバックする', () => {
    const holding = makeHolding({ scenarioId: undefined, v2CompanyId: 'company-1', investmentAmount: 300 })
    const result = evaluateHolding(holding, null, EVAL_DATE, null)
    expect(result.isCostBasis).toBe(true)
    expect(result.marketValue).toEqual({ pessimistic: 300, base: 300, optimistic: 300 })
  })

  it('v2CompanyIdが設定されていればscenarioIdより優先する', () => {
    const scenario = createScenario('saas_jp', 'OK') as Extract<Scenario, { sector: 'saas_jp' }>
    const holding = makeHolding({ scenarioId: scenario.id, v2CompanyId: 'company-1', ownershipPct: 0.1 })
    const result = evaluateHolding(holding, scenario, EVAL_DATE, v2Valuation)
    expect(result.marketValue.base).toBeCloseTo(400, 6) // 4000 * 0.1、シナリオEVは無視される
  })
})

describe('aggregatePortfolio(ファンド単位集計、§3.4)', () => {
  it('時価総額は3点、投資額合計・ファンドMOICを算出する', () => {
    const scenario = createScenario('saas_jp', 'OK')
    const holdingA = makeHolding({ id: 'a', investmentAmount: 300, ownershipPct: 0.1, scenarioId: scenario.id })
    const holdingB = makeHolding({ id: 'b', investmentAmount: 200, scenarioId: undefined }) // コスト評価
    const scenarioById = new Map([[scenario.id, scenario]])

    const summary = aggregatePortfolio([holdingA, holdingB], scenarioById, EVAL_DATE)

    expect(summary.totalInvestment).toBe(500)
    expect(summary.hasCostBasisHoldings).toBe(true)
    // holdingA: base=1040(前テスト参照)、holdingB: コスト評価で200
    expect(summary.totalMarketValue.base).toBeCloseTo(1240, 6)
    expect(summary.fundMoic).toBeCloseTo(1240 / 500, 9)
  })

  it('投資日未設定の銘柄が1件でもあればファンドIRRは「—」+注記になる', () => {
    const holdingA = makeHolding({ id: 'a', investmentDate: '2025-07-14' })
    const holdingB = makeHolding({ id: 'b', investmentDate: null })
    const summary = aggregatePortfolio([holdingA, holdingB], new Map(), EVAL_DATE)
    expect(summary.fundIrr).toBeNull()
    expect(summary.fundIrrUnavailableReason).toBe('投資日未設定の銘柄があります')
  })

  it('全銘柄に投資日があれば連結CFからファンドIRRを算出する', () => {
    const scenario = createScenario('saas_jp', 'OK')
    const holdingA = makeHolding({ id: 'a', investmentDate: '2025-07-14', scenarioId: scenario.id })
    const holdingB = makeHolding({ id: 'b', investmentDate: '2024-07-14', investmentAmount: 100 })
    const scenarioById = new Map([[scenario.id, scenario]])
    const summary = aggregatePortfolio([holdingA, holdingB], scenarioById, EVAL_DATE)
    expect(summary.fundIrr).not.toBeNull()
    expect(summary.fundIrrUnavailableReason).toBeNull()
  })

  it('銘柄が0件のときはファンドIRRを算出せず理由を返す', () => {
    const summary = aggregatePortfolio([], new Map(), EVAL_DATE)
    expect(summary.totalInvestment).toBe(0)
    expect(summary.fundMoic).toBeNull()
    expect(summary.fundIrr).toBeNull()
    expect(summary.fundIrrUnavailableReason).toBe('銘柄がありません')
  })

  it('V2連動銘柄を含む集計はv2ValuationByCompanyIdから時価を解決する', () => {
    const holdingA = makeHolding({ id: 'a', investmentAmount: 300, ownershipPct: 0.1, v2CompanyId: 'company-1' })
    const v2ValuationByCompanyId = new Map<string, V2LinkedValuation | null>([
      ['company-1', { companyId: 'company-1', companyName: 'V2株式会社', currentAllowablePostMoney: 5000 }],
    ])
    const summary = aggregatePortfolio([holdingA], new Map(), EVAL_DATE, v2ValuationByCompanyId)
    expect(summary.totalMarketValue.base).toBeCloseTo(500, 6) // 5000 * 0.1
    expect(summary.hasCostBasisHoldings).toBe(false)
  })
})
