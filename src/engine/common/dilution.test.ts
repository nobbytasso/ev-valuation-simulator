import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { irrClosedFormSingle } from './npv.ts'
import { simulateDilution } from './dilution.ts'
import type { CapTableHolder, DilutionInputs, FundingRound } from './dilution.ts'

const initialCapTable: CapTableHolder[] = [{ id: 'founders', name: 'Founders', ownership: 1 }]

const roundArb = fc.record({
  preMoneyValuation: fc.float({ min: Math.fround(100), max: Math.fround(100000), noNaN: true }),
  amountRaisedRatio: fc.float({ min: Math.fround(0.05), max: Math.fround(0.6), noNaN: true }), // amountRaised as ratio of preMoney
  optionPoolPostPct: fc.float({ min: Math.fround(0), max: Math.fround(0.3), noNaN: true }),
  fundShare: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }), // fundInvestment as share of amountRaised
})

function buildRounds(
  specs: { preMoneyValuation: number; amountRaisedRatio: number; optionPoolPostPct: number; fundShare: number }[],
): FundingRound[] {
  return specs.map((s, idx) => {
    const amountRaised = s.preMoneyValuation * s.amountRaisedRatio
    return {
      name: `Round-${idx}`,
      yearIndex: idx,
      preMoneyValuation: s.preMoneyValuation,
      amountRaised,
      optionPoolPostPct: s.optionPoolPostPct,
      fundInvestment: amountRaised * s.fundShare,
    }
  })
}

describe('simulateDilution', () => {
  it('P11: 任意のラウンド列で各ラウンド後の持分総和 = 1', () => {
    fc.assert(
      fc.property(fc.array(roundArb, { minLength: 1, maxLength: 5 }), (specs) => {
        const rounds = buildRounds(specs)
        const inputs: DilutionInputs = {
          initialCapTable,
          rounds,
          exit: { yearIndex: rounds.length, equityValue: 10000 },
        }
        const result = simulateDilution(inputs)
        for (const snapshot of result.rounds) {
          const sum = snapshot.capTableAfter.reduce((acc, h) => acc + h.ownership, 0)
          expect(Math.abs(sum - 1)).toBeLessThan(1e-9)
        }
      }),
      { numRuns: 200 },
    )
  })

  it('Exit時実効持分の総和 = 1、分配額の総和 = exit.equityValue', () => {
    fc.assert(
      fc.property(
        fc.array(roundArb, { minLength: 1, maxLength: 5 }),
        fc.float({ min: Math.fround(1), max: Math.fround(1e6), noNaN: true }),
        (specs, equityValue) => {
          const rounds = buildRounds(specs)
          const inputs: DilutionInputs = {
            initialCapTable,
            rounds,
            exit: { yearIndex: rounds.length, equityValue },
          }
          const result = simulateDilution(inputs)
          const ownershipSum = result.exitCapTable.reduce((acc, h) => acc + h.effectiveOwnership, 0)
          const payoutSum = result.exitCapTable.reduce((acc, h) => acc + h.payout, 0)
          expect(Math.abs(ownershipSum - 1)).toBeLessThan(1e-9)
          expect(Math.abs(payoutSum - equityValue)).toBeLessThan(1e-6 * Math.max(1, equityValue))
        },
      ),
      { numRuns: 200 },
    )
  })

  it('未消化プールはExit時に無視され、残余保有者で再正規化される(U-14)', () => {
    const rounds = buildRounds([
      { preMoneyValuation: 1000, amountRaisedRatio: 0.25, optionPoolPostPct: 0.15, fundShare: 0.5 },
    ])
    const inputs: DilutionInputs = {
      initialCapTable,
      rounds,
      exit: { yearIndex: 1, equityValue: 10000 },
    }
    const result = simulateDilution(inputs)
    expect(result.exitCapTable.some((h) => h.id.includes('pool'))).toBe(false)
    const ownershipSum = result.exitCapTable.reduce((acc, h) => acc + h.effectiveOwnership, 0)
    expect(ownershipSum).toBeCloseTo(1, 9)
  })

  it('P12: 単一ラウンド・単一Exitのファンド IRR は閉形式と一致する', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(100), max: Math.fround(10000), noNaN: true }),
        fc.float({ min: Math.fround(0.1), max: Math.fround(0.5), noNaN: true }),
        fc.integer({ min: 1, max: 10 }),
        fc.float({ min: Math.fround(1000), max: Math.fround(1e6), noNaN: true }),
        (preMoneyValuation, amountRaisedRatio, exitYear, equityValue) => {
          const amountRaised = preMoneyValuation * amountRaisedRatio
          const rounds: FundingRound[] = [
            {
              name: 'Series A',
              yearIndex: 0,
              preMoneyValuation,
              amountRaised,
              optionPoolPostPct: 0,
              fundInvestment: amountRaised,
            },
          ]
          const inputs: DilutionInputs = {
            initialCapTable,
            rounds,
            exit: { yearIndex: exitYear, equityValue },
          }
          const result = simulateDilution(inputs)
          const fundHolder = result.exitCapTable.find((h) => h.id.includes('fund'))
          expect(fundHolder).toBeDefined()
          if (!fundHolder) return
          const closedForm = irrClosedFormSingle(amountRaised, fundHolder.payout, exitYear)
          if (closedForm !== null && closedForm > -0.9999 && closedForm <= 10.0 && result.fundIrr !== null) {
            expect(Math.abs(closedForm - result.fundIrr)).toBeLessThan(1e-6)
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})
