import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { closeEnough } from '../types.ts'
import { applyEcD2cDriver, EC_D2C_SENSITIVITY_DRIVERS, ecD2cBaseEv, evaluateEcD2c } from './ecD2c.ts'
import type { EcD2cInputs } from './ecD2c.ts'
import { buildTornado } from '../common/sensitivity.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface GoldenCase {
  id: string
  tags: string[]
  input: EcD2cInputs
  expected: { ev: { pessimistic: number; base: number; optimistic: number }; keyMetrics: Record<string, number> }
}
interface GoldenFile {
  cases: GoldenCase[]
}
function loadGolden(): GoldenFile {
  const p = path.join(__dirname, '../__fixtures__/ec_d2c.golden.json')
  return JSON.parse(readFileSync(p, 'utf-8')) as GoldenFile
}

describe('EcD2c golden fixtures', () => {
  const golden = loadGolden()
  it.each(golden.cases.map((c) => [c.id, c] as const))('%s: golden一致', (_id, c) => {
    const result = evaluateEcD2c(c.input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(closeEnough(result.value.ev.pessimistic, c.expected.ev.pessimistic)).toBe(true)
    expect(closeEnough(result.value.ev.base, c.expected.ev.base)).toBe(true)
    expect(closeEnough(result.value.ev.optimistic, c.expected.ev.optimistic)).toBe(true)
    const actualKeys = Object.keys(result.value.keyMetrics).sort()
    const expectedKeys = Object.keys(c.expected.keyMetrics).sort()
    expect(actualKeys).toEqual(expectedKeys)
    for (const k of expectedKeys) {
      expect(closeEnough(result.value.keyMetrics[k], c.expected.keyMetrics[k])).toBe(true)
    }
  })
})

function buildInputs(overrides: Partial<EcD2cInputs> = {}): EcD2cInputs {
  return {
    annualRevenue: 2000,
    revenueGrowth: 0.2,
    grossMargin: 0.45,
    f2Rate: 0.35,
    aov: 8000,
    purchaseFrequency: 2.5,
    cac: 4000,
    adCostRatio: 0.15,
    logisticsCostRatio: 0.1,
    inventoryTurnover: 6,
    multipleBasis: 'revenue',
    evMultiple: { pessimistic: 1.5, base: 2.5, optimistic: 4 },
    maxLifetimeYears: 10,
    ...overrides,
  }
}

describe('EcD2c プロパティ', () => {
  it('annualRevenue = 0 ⇒ EV = 0', () => {
    const result = evaluateEcD2c(buildInputs({ annualRevenue: 0 }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.ev.base).toBeCloseTo(0, 9)
  })

  it('P9: f2Rate ↑ ⇒ LTV 単調非減少(上限キャップ含む)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: Math.fround(0.9), noNaN: true }),
        fc.float({ min: Math.fround(0.001), max: Math.fround(0.09), noNaN: true }),
        (f, delta) => {
          const r1 = evaluateEcD2c(buildInputs({ f2Rate: f }))
          const r2 = evaluateEcD2c(buildInputs({ f2Rate: Math.min(f + delta, 0.999) }))
          expect(r1.ok && r2.ok).toBe(true)
          if (!r1.ok || !r2.ok) return
          expect(r2.value.keyMetrics.ltv).toBeGreaterThanOrEqual(r1.value.keyMetrics.ltv - 1e-6)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('f2Rate → 1 でも lifetimeYears は maxLifetimeYears でキャップされ発散しない', () => {
    const result = evaluateEcD2c(buildInputs({ f2Rate: 0.9999, maxLifetimeYears: 10 }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const annualValue = 8000 * 2.5 * 0.45
    expect(result.value.keyMetrics.ltv).toBeCloseTo(annualValue * 10, 6)
  })

  it('revenueGrowth ↑ ⇒ EV 単調増加', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(-0.5), max: Math.fround(1), noNaN: true }),
        fc.float({ min: Math.fround(0.001), max: Math.fround(0.5), noNaN: true }),
        (g, delta) => {
          const r1 = evaluateEcD2c(buildInputs({ revenueGrowth: g }))
          const r2 = evaluateEcD2c(buildInputs({ revenueGrowth: g + delta }))
          expect(r1.ok && r2.ok).toBe(true)
          if (!r1.ok || !r2.ok) return
          expect(r2.value.ev.base).toBeGreaterThan(r1.value.ev.base)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('P15: レンジ順序 pessimistic ≤ base ≤ optimistic', () => {
    const result = evaluateEcD2c(buildInputs())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.ev.pessimistic).toBeLessThanOrEqual(result.value.ev.base + 1e-6)
    expect(result.value.ev.base).toBeLessThanOrEqual(result.value.ev.optimistic + 1e-6)
  })

  it('ltvCacRatio は cac > 0 のときのみ算出される', () => {
    const result = evaluateEcD2c(buildInputs({ cac: 0 }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.keyMetrics.ltvCacRatio).toBeUndefined()
    expect(result.value.keyMetrics.ltv).toBeDefined()
  })

  it('感度分析: δ=0でspan=0', () => {
    const inputs = buildInputs()
    const items = buildTornado(
      inputs,
      { delta: 0, driverIds: [...EC_D2C_SENSITIVITY_DRIVERS] },
      applyEcD2cDriver,
      ecD2cBaseEv,
    )
    for (const item of items) expect(item.span).toBeCloseTo(0, 6)
  })

  const domainViolations: ((i: EcD2cInputs) => EcD2cInputs)[] = [
    (i) => ({ ...i, annualRevenue: -1 }),
    (i) => ({ ...i, revenueGrowth: -1 }),
    (i) => ({ ...i, grossMargin: 1.5 }),
    (i) => ({ ...i, f2Rate: 1 }),
    (i) => ({ ...i, f2Rate: -0.1 }),
    (i) => ({ ...i, aov: -1 }),
    (i) => ({ ...i, purchaseFrequency: -1 }),
    (i) => ({ ...i, cac: -1 }),
    (i) => ({ ...i, adCostRatio: 1.5 }),
    (i) => ({ ...i, logisticsCostRatio: -0.1 }),
    (i) => ({ ...i, inventoryTurnover: 0 }),
    (i) => ({ ...i, evMultiple: { ...i.evMultiple, base: 0 } }),
    (i) => ({ ...i, maxLifetimeYears: 0 }),
  ]

  it('ドメイン外入力 → ok:false(§0.2.1)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...domainViolations), (corrupt) => {
        const result = evaluateEcD2c(corrupt(buildInputs()))
        expect(result.ok).toBe(false)
      }),
      { numRuns: 50 },
    )
  })
})
