import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { irrBisection, irrClosedFormSingle, moic, presentValue, terminalValue } from './npv.ts'

describe('presentValue', () => {
  it('P1: CF >= 0 のとき、割引率 r が上がるほど NPV は単調減少する', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ t: fc.integer({ min: 0, max: 30 }), cf: fc.float({ min: 0, max: 1e6, noNaN: true }) }), {
          minLength: 1,
          maxLength: 20,
        }),
        fc.float({ min: Math.fround(-0.5), max: Math.fround(2), noNaN: true }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(2), noNaN: true }),
        (cashflows, rLow, delta) => {
          const rHigh = rLow + delta
          // 少なくとも1つのCFが正であることを担保(全て0だと差が出ない)
          const hasPositive = cashflows.some((c) => c.cf > 0)
          fc.pre(hasPositive)
          const npvLow = presentValue(rLow, cashflows)
          const npvHigh = presentValue(rHigh, cashflows)
          expect(npvHigh).toBeLessThanOrEqual(npvLow + 1e-6)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('t の並び順に依存せず同じ結果を返す(総和順序の安定性)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ t: fc.integer({ min: 0, max: 10 }), cf: fc.float({ min: -1000, max: 1000, noNaN: true }) }), {
          minLength: 1,
          maxLength: 10,
        }),
        (cashflows) => {
          const shuffled = [...cashflows].reverse()
          const a = presentValue(0.1, cashflows)
          const b = presentValue(0.1, shuffled)
          expect(a).toBeCloseTo(b, 9)
        },
      ),
    )
  })
})

describe('terminalValue', () => {
  it('r <= terminalGrowth は ValidationIssue を返す', () => {
    const result = terminalValue(100, 0.05, 0.05)
    expect(result.ok).toBe(false)
  })

  it('r > terminalGrowth では正常値を返す', () => {
    const result = terminalValue(100, 0.1, 0.02)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBeCloseTo((100 * 1.02) / 0.08, 9)
    }
  })
})

describe('IRR', () => {
  it('P12: 単一投資・単一回収の閉形式IRRは二分法解と一致する', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
        fc.integer({ min: 1, max: 15 }),
        (investment, exitAmount, years) => {
          const closedForm = irrClosedFormSingle(investment, exitAmount, years)
          expect(closedForm).not.toBeNull()
          if (closedForm === null) return
          // 閉形式が二分法の探索区間 (-0.9999, 10.0] を超える場合は二分法側が null や境界値に
          // なり得るため、区間内に収まるケースのみ厳密一致を要求する。
          fc.pre(closedForm > -0.9999 && closedForm <= 10.0)
          const bisection = irrBisection([
            { t: 0, cf: -investment },
            { t: years, cf: exitAmount },
          ])
          expect(bisection).not.toBeNull()
          if (bisection === null) return
          expect(Math.abs(closedForm - bisection)).toBeLessThan(1e-6)
        },
      ),
      { numRuns: 300 },
    )
  })

  it('正負両方のCFが無ければ null を返す', () => {
    expect(irrBisection([{ t: 0, cf: -100 }])).toBeNull()
    expect(irrBisection([{ t: 0, cf: 100 }])).toBeNull()
    expect(irrBisection([{ t: 0, cf: -100 }, { t: 1, cf: -50 }])).toBeNull()
  })

  it('既知の単純ケース: 投資100、1年後に110回収 → IRR = 10%', () => {
    const irr = irrBisection([
      { t: 0, cf: -100 },
      { t: 1, cf: 110 },
    ])
    expect(irr).not.toBeNull()
    if (irr !== null) expect(irr).toBeCloseTo(0.1, 9)
  })
})

describe('MOIC', () => {
  it('負のCFが無い場合は null を返す', () => {
    expect(moic([{ t: 0, cf: 100 }])).toBeNull()
  })

  it('MOIC = 正のCF合計 / |負のCF合計|', () => {
    const m = moic([
      { t: 0, cf: -100 },
      { t: 1, cf: -50 },
      { t: 2, cf: 450 },
    ])
    expect(m).toBeCloseTo(3, 9)
  })

  it('MOICは割引しない(タイミングに依存しない)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
        fc.float({ min: Math.fround(1), max: Math.fround(5000), noNaN: true }),
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        (investment, exitAmount, t1, t2) => {
          const m = moic([
            { t: t1, cf: -investment },
            { t: t2, cf: exitAmount },
          ])
          expect(m).toBeCloseTo(exitAmount / investment, 9)
        },
      ),
    )
  })
})
