import { describe, expect, it } from 'vitest'
import { createDefaultWorkbench } from '../../v2/domain/sectorDefinitions.ts'
import type { WorkbenchCollection } from '../../v2/domain/types.ts'
import type { PortfolioHolding } from '../../store/scenarioTypes.ts'
import {
  buildFundFollowOnCashflows,
  buildV2ValuationMap,
  listV2CompanyOptions,
  resolveV2CompanyValuation,
} from './v2Linking.ts'

function makeHolding(overrides: Partial<PortfolioHolding> = {}): PortfolioHolding {
  return {
    id: 'holding-1',
    companyName: 'V2連動株式会社',
    sector: 'saas_jp',
    investmentAmount: 300,
    round: 'シリーズA',
    ownershipPct: 0.1,
    investmentDate: '2025-07-14',
    schemaVersion: 3,
    createdAt: '2026-07-14T00:00:00.000Z',
    updatedAt: '2026-07-14T00:00:00.000Z',
    ...overrides,
  }
}

describe('resolveV2CompanyValuation', () => {
  it('会社が存在しないときnull', () => {
    expect(resolveV2CompanyValuation(undefined)).toBeNull()
  })

  it('adoptedCaseIdが未選択のときnull', () => {
    const state = createDefaultWorkbench('saas_jp', 'A社')
    expect(resolveV2CompanyValuation(state)).toBeNull()
  })

  it('採用ケースが解決できるときcurrentAllowablePostMoneyを返す', () => {
    const state = createDefaultWorkbench('saas_jp', 'A社')
    const adopted = { ...state, adoptedCaseId: state.cases[0].id }
    const result = resolveV2CompanyValuation(adopted)
    expect(result).not.toBeNull()
    expect(result?.companyName).toBe('A社')
    expect(result?.currentAllowablePostMoney).toBeGreaterThan(0)
  })

  it('adoptedCaseIdが削除済みケースを指すときnull', () => {
    const state = createDefaultWorkbench('saas_jp', 'A社')
    const adopted = { ...state, adoptedCaseId: 'deleted-case-id' }
    expect(resolveV2CompanyValuation(adopted)).toBeNull()
  })
})

describe('listV2CompanyOptions / buildV2ValuationMap', () => {
  it('会社名の昇順で選択肢を返す', () => {
    const stateB = createDefaultWorkbench('saas_jp', 'B社')
    const stateA = createDefaultWorkbench('ec_d2c', 'A社')
    const collection: WorkbenchCollection = {
      activeCompanyId: stateB.company.id,
      workbenches: { [stateB.company.id]: stateB, [stateA.company.id]: stateA },
    }
    const options = listV2CompanyOptions(collection)
    expect(options.map((o) => o.name)).toEqual(['A社', 'B社'])
  })

  it('buildV2ValuationMapは全社のキーを持つ(未選択はnull)', () => {
    const state = createDefaultWorkbench('saas_jp', 'A社')
    const collection: WorkbenchCollection = { activeCompanyId: state.company.id, workbenches: { [state.company.id]: state } }
    const map = buildV2ValuationMap(collection)
    expect(map.get(state.company.id)).toBeNull()
  })
})

describe('buildFundFollowOnCashflows', () => {
  it('V2未連動・採用ケース未選択の銘柄は集計から除外する', () => {
    const holding = makeHolding({ v2CompanyId: null })
    const collection: WorkbenchCollection = { activeCompanyId: 'x', workbenches: {} }
    expect(buildFundFollowOnCashflows([holding], collection)).toEqual([])
  })

  it('採用ケースが解決できる単一銘柄のCFをそのまま返す(ownershipPctは二重適用しない)', () => {
    const state = createDefaultWorkbench('saas_jp', 'A社')
    const adopted = { ...state, adoptedCaseId: state.cases[0].id }
    const collection: WorkbenchCollection = { activeCompanyId: adopted.company.id, workbenches: { [adopted.company.id]: adopted } }
    const holding = makeHolding({ v2CompanyId: adopted.company.id, ownershipPct: 0.5 })

    const cashflows = buildFundFollowOnCashflows([holding], collection)

    expect(cashflows[0]).toEqual({ t: 0, cf: -adopted.cases[0].investmentAmount })
    const lastYear = adopted.cases[0].yearsToExit
    const lastEntry = cashflows.find((c) => c.t === lastYear)
    expect(lastEntry?.cf).toBeGreaterThan(0)
  })

  it('複数銘柄の同年キャッシュフローを合算する', () => {
    const stateA = createDefaultWorkbench('saas_jp', 'A社')
    const adoptedA = { ...stateA, adoptedCaseId: stateA.cases[0].id }
    const stateB = createDefaultWorkbench('saas_jp', 'B社')
    const adoptedB = { ...stateB, adoptedCaseId: stateB.cases[0].id }
    const collection: WorkbenchCollection = {
      activeCompanyId: adoptedA.company.id,
      workbenches: { [adoptedA.company.id]: adoptedA, [adoptedB.company.id]: adoptedB },
    }
    const holdings = [
      makeHolding({ id: 'a', v2CompanyId: adoptedA.company.id }),
      makeHolding({ id: 'b', v2CompanyId: adoptedB.company.id }),
    ]

    const cashflows = buildFundFollowOnCashflows(holdings, collection)
    const initial = cashflows.find((c) => c.t === 0)
    expect(initial?.cf).toBeCloseTo(-2 * adoptedA.cases[0].investmentAmount, 6)
  })
})
