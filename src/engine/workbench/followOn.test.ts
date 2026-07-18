import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { computeFollowOnReturn } from './followOn.ts'
import type { WorkbenchFollowOnCoreInputs } from './followOn.ts'
import type { WorkbenchFollowOnInput } from './types.ts'

const baseCore: WorkbenchFollowOnCoreInputs = {
  investmentAmount: 300,
  proposedPreMoney: 2700,
  yearsToExit: 5,
  dilutionRetention: 0.7,
}

describe('computeFollowOnReturn', () => {
  it('追加出資0件のとき、初回のみのExit持分・MOIC・IRRを返す(既存expectedMoic/expectedIrrと整合)', () => {
    const result = computeFollowOnReturn(baseCore, [], 10000)
    // e_0 = 300 / (2700+300) = 0.1、Exit持分 = 0.1 * 0.7 = 0.07、回収 = 10000 * 0.07 = 700
    expect(result.initialOwnershipShare).toBeCloseTo(0.1, 9)
    expect(result.totalOwnershipShare).toBeCloseTo(0.1, 9)
    expect(result.exitOwnershipShare).toBeCloseTo(0.07, 9)
    expect(result.proceeds).toBeCloseTo(700, 6)
    expect(result.totalInvested).toBe(300)
    expect(result.moic).toBeCloseTo(700 / 300, 9)
    expect(result.irr).not.toBeNull()
    expect(result.irr as number).toBeCloseTo(Math.pow(700 / 300, 1 / 5) - 1, 6)
    expect(result.tranches).toHaveLength(0)
    expect(result.warnings).toEqual([])
  })

  it('追加出資1件: e_1=amount/postMoney、前回Post-money比=提示Post-moneyに対する倍率(R-V2-2)', () => {
    const followOns: WorkbenchFollowOnInput[] = [{ label: 'シリーズB', yearOffset: 2, amount: 500, postMoney: 5000 }]
    const result = computeFollowOnReturn(baseCore, followOns, 10000)
    expect(result.tranches).toHaveLength(1)
    const tranche = result.tranches[0]
    expect(tranche.ownershipShare).toBeCloseTo(500 / 5000, 9) // 0.1
    // 前回Post-money = proposedPreMoney + investmentAmount = 3000
    expect(tranche.multipleOfPreviousPostMoney).toBeCloseTo(5000 / 3000, 9)
    expect(result.totalOwnershipShare).toBeCloseTo(0.1 + 0.1, 9)
    expect(result.totalInvested).toBe(800)
  })

  it('追加出資複数件: 2件目の前回Post-moneyは1件目のPost-money', () => {
    const followOns: WorkbenchFollowOnInput[] = [
      { label: 'シリーズB', yearOffset: 2, amount: 500, postMoney: 5000 },
      { label: 'シリーズC', yearOffset: 4, amount: 800, postMoney: 4000 }, // 前回比down-round
    ]
    const result = computeFollowOnReturn(baseCore, followOns, 10000)
    expect(result.tranches).toHaveLength(2)
    expect(result.tranches[0].multipleOfPreviousPostMoney).toBeCloseTo(5000 / 3000, 9)
    expect(result.tranches[1].multipleOfPreviousPostMoney).toBeCloseTo(4000 / 5000, 9) // 0.8x(down-round)
    expect(result.totalInvested).toBe(1600)
    const cashflowSumSanityMoic =
      result.proceeds / (baseCore.investmentAmount + followOns.reduce((s, f) => s + f.amount, 0))
    expect(result.moic).toBeCloseTo(cashflowSumSanityMoic, 9)
  })

  it('持分合計が100%を超えるときは警告を返す', () => {
    const followOns: WorkbenchFollowOnInput[] = [
      { label: 'A', yearOffset: 1, amount: 4700, postMoney: 5000 }, // e = 0.94、初回0.1と合わせて1.04
    ]
    const result = computeFollowOnReturn(baseCore, followOns, 10000)
    expect(result.totalOwnershipShare).toBeGreaterThan(1)
    expect(result.warnings).toContain('追加出資を含む持分合計が100%を超えています。')
  })

  it('exitEquityValueが負のときは回収0(max(0, exitEquityValue))', () => {
    const result = computeFollowOnReturn(baseCore, [], -500)
    expect(result.proceeds).toBe(0)
    expect(result.moic).toBe(0)
  })
})

const followOnArb: fc.Arbitrary<WorkbenchFollowOnInput> = fc.record({
  label: fc.constant('tranche'),
  yearOffset: fc.integer({ min: 1, max: 6 }),
  amount: fc.float({ min: Math.fround(1), max: Math.fround(500), noNaN: true }),
  postMoney: fc.float({ min: Math.fround(1000), max: Math.fround(20000), noNaN: true }),
})

const coreArb: fc.Arbitrary<WorkbenchFollowOnCoreInputs> = fc.record({
  proposedPreMoney: fc.float({ min: Math.fround(0), max: Math.fround(10000), noNaN: true }),
  investmentAmount: fc.float({ min: Math.fround(0), max: Math.fround(3000), noNaN: true }),
  yearsToExit: fc.integer({ min: 1, max: 10 }),
  dilutionRetention: fc.float({ min: Math.fround(0.01), max: 1, noNaN: true }),
})

describe('P21: 追加出資プロパティ', () => {
  it('各トランシェの持分 e_i = amount/postMoney は amount∈[0, postMoney] のとき[0,1]に収まる', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1), max: Math.fround(20000), noNaN: true }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        (postMoney, fraction) => {
          const amount = postMoney * fraction
          const followOns: WorkbenchFollowOnInput[] = [{ label: 't', yearOffset: 1, amount, postMoney }]
          const result = computeFollowOnReturn(baseCore, followOns, 10000)
          const tranche = result.tranches[0]
          expect(tranche.ownershipShare).toBeGreaterThanOrEqual(-1e-9)
          expect(tranche.ownershipShare).toBeLessThanOrEqual(1 + 1e-9)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('回収 = max(0, exitEquityValue) × Exit持分(任意の入力・トランシェ数で恒等的に成立)', () => {
    fc.assert(
      fc.property(
        coreArb,
        fc.array(followOnArb, { minLength: 0, maxLength: 5 }),
        fc.float({ min: Math.fround(-1000), max: Math.fround(50000), noNaN: true }),
        (core, followOns, exitEquityValue) => {
          const result = computeFollowOnReturn(core, followOns, exitEquityValue)
          expect(result.proceeds).toBeCloseTo(Math.max(0, exitEquityValue) * result.exitOwnershipShare, 6)
          // MOICはΣamount>0のときのみ定義される
          if (result.totalInvested > 0) {
            expect(result.moic).toBeCloseTo(result.proceeds / result.totalInvested, 6)
          } else {
            expect(result.moic).toBeNull()
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})
