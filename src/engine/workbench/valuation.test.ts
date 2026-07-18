import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { buildWorkbenchCaseResult, projectMetric } from './valuation.ts'
import type { WorkbenchCaseCoreInputs, WorkbenchExitValuation } from './types.ts'

const baseCore: WorkbenchCaseCoreInputs = {
  fullyDilutedShares: 10,
  proposedPreMoney: 3000,
  investmentAmount: 300,
  targetMoic: 10,
  yearsToExit: 5,
  dilutionRetention: 0.7,
  exitNetDebt: 0,
}

describe('projectMetric', () => {
  it('projects a decaying growth series to the exit year', () => {
    const result = projectMetric(100, 0.2, 0.5, 2)
    expect(result.value).toBeCloseTo(132)
    expect(result.finalGrowth).toBeCloseTo(0.1)
  })
})

describe('buildWorkbenchCaseResult', () => {
  it('bridges exit EV to current pre-money and share price', () => {
    const result = buildWorkbenchCaseResult(baseCore, {
      exitMetricLabel: 'Exit ARR',
      exitMetric: 1000,
      exitEnterpriseValue: 10000,
    })
    expect(result.exitEquityValue).toBe(10000)
    expect(result.currentAllowablePostMoney).toBe(1000)
    expect(result.currentAllowablePreMoney).toBe(700)
    expect(result.theoreticalSharePrice).toBe(70)
    expect(result.requiredEntryOwnership).toBeCloseTo(0.3)
  })

  it('computes expected return from the proposed entry valuation', () => {
    const result = buildWorkbenchCaseResult(baseCore, {
      exitMetricLabel: 'Exit ARR',
      exitMetric: 1000,
      exitEnterpriseValue: 10000,
    })
    expect(result.expectedEntryOwnership).toBeCloseTo(300 / 3300)
    expect(result.expectedExitOwnership).toBeCloseTo((300 / 3300) * 0.7)
    expect(result.expectedMoic).not.toBeNull()
  })
})

const exitArb: fc.Arbitrary<WorkbenchExitValuation> = fc.record({
  exitMetricLabel: fc.constant('Exit ARR'),
  exitMetric: fc.float({ min: Math.fround(0), max: Math.fround(10000), noNaN: true }),
  exitEnterpriseValue: fc.float({ min: Math.fround(1), max: Math.fround(1_000_000), noNaN: true }),
})

const coreArb: fc.Arbitrary<WorkbenchCaseCoreInputs> = fc.record({
  fullyDilutedShares: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
  proposedPreMoney: fc.float({ min: Math.fround(0), max: Math.fround(10000), noNaN: true }),
  investmentAmount: fc.float({ min: Math.fround(1), max: Math.fround(2000), noNaN: true }),
  targetMoic: fc.float({ min: Math.fround(0.5), max: Math.fround(20), noNaN: true }),
  yearsToExit: fc.integer({ min: 1, max: 10 }),
  dilutionRetention: fc.float({ min: Math.fround(0.01), max: 1, noNaN: true }),
  exitNetDebt: fc.float({ min: Math.fround(-1000), max: Math.fround(1000), noNaN: true }),
})

describe('V2 Workbench プロパティ', () => {
  it('P19: targetMoic ↑ ⇒ currentAllowablePostMoney 単調非増加(Exit株式価値が正のとき)', () => {
    fc.assert(
      fc.property(
        exitArb,
        coreArb,
        fc.float({ min: Math.fround(0.01), max: Math.fround(10), noNaN: true }),
        (exit, core, delta) => {
          fc.pre(exit.exitEnterpriseValue - core.exitNetDebt > 0)
          const lower = buildWorkbenchCaseResult(core, exit)
          const higher = buildWorkbenchCaseResult({ ...core, targetMoic: core.targetMoic + delta }, exit)
          expect(higher.currentAllowablePostMoney).toBeLessThanOrEqual(lower.currentAllowablePostMoney + 1e-6)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('P20: expectedMoic と expectedIrr の整合(expectedIrr = expectedMoic^(1/yearsToExit) − 1)', () => {
    fc.assert(
      fc.property(exitArb, coreArb, (exit, core) => {
        const result = buildWorkbenchCaseResult(core, exit)
        if (result.expectedMoic === null) {
          expect(result.expectedIrr).toBeNull()
          return
        }
        if (result.expectedMoic < 0 || core.yearsToExit <= 0) {
          expect(result.expectedIrr).toBeNull()
          return
        }
        expect(result.expectedIrr).not.toBeNull()
        const expectedIrr = Math.pow(result.expectedMoic, 1 / core.yearsToExit) - 1
        expect(result.expectedIrr as number).toBeCloseTo(expectedIrr, 6)
      }),
      { numRuns: 100 },
    )
  })
})
