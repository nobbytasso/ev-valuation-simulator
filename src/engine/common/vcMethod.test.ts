import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { computeVcMethod } from './vcMethod.ts'
import type { VcMethodInputs } from './vcMethod.ts'

function baseInputs(overrides: Partial<VcMethodInputs> = {}): VcMethodInputs {
  return {
    exitEnterpriseValue: 10000,
    netDebtAtExit: 0,
    targetMultiple: 10,
    yearsToExit: 5,
    investment: 200,
    dilutionRetention: 0.8,
    ...overrides,
  }
}

describe('computeVcMethod', () => {
  it('P13: targetMultiple が上がるほど impliedPostMoneyNow は単調減少する', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1), max: Math.fround(50), noNaN: true }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(50), noNaN: true }),
        (m1, delta) => {
          const m2 = m1 + delta
          const r1 = computeVcMethod(baseInputs({ targetMultiple: m1 }))
          const r2 = computeVcMethod(baseInputs({ targetMultiple: m2 }))
          expect(r2.impliedPostMoneyNow).toBeLessThanOrEqual(r1.impliedPostMoneyNow + 1e-9)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('数式通りの基本計算', () => {
    const result = computeVcMethod(baseInputs())
    expect(result.exitEquityValue).toBeCloseTo(10000, 9)
    expect(result.impliedPostMoneyNow).toBeCloseTo(1000, 9)
    expect(result.impliedIrr).toBeCloseTo(Math.pow(10, 1 / 5) - 1, 9)
    expect(result.requiredOwnershipAtExit).toBeCloseTo((200 * 10) / 10000, 9)
    expect(result.requiredOwnershipAtEntry).toBeCloseTo(((200 * 10) / 10000) / 0.8, 9)
  })

  it('requiredOwnershipAtEntry > 1 はエラーにせず isInfeasible フラグを立てる', () => {
    // 投資額に対しExit株式価値が極端に小さい → 必要持分が100%を超える
    const result = computeVcMethod(
      baseInputs({ investment: 5000, exitEnterpriseValue: 6000, targetMultiple: 10, dilutionRetention: 0.5 }),
    )
    expect(result.requiredOwnershipAtEntry).toBeGreaterThan(1)
    expect(result.isInfeasible).toBe(true)

    const feasible = computeVcMethod(baseInputs())
    expect(feasible.isInfeasible).toBe(false)
  })

  it('netDebtAtExit が exitEquityValue を正しく減算する', () => {
    const result = computeVcMethod(baseInputs({ netDebtAtExit: 1000 }))
    expect(result.exitEquityValue).toBeCloseTo(9000, 9)
  })
})
