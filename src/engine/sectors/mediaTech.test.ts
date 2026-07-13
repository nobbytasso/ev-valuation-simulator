import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { closeEnough } from '../types.ts'
import {
  applyMediaTechDriver,
  evaluateMediaTech,
  MEDIA_TECH_SENSITIVITY_DRIVERS,
  mediaTechBaseEv,
} from './mediaTech.ts'
import type { MediaTechInputs } from './mediaTech.ts'
import { buildTornado } from '../common/sensitivity.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface GoldenCase {
  id: string
  tags: string[]
  input: MediaTechInputs
  expected: { ev: { pessimistic: number; base: number; optimistic: number }; keyMetrics: Record<string, number> }
}
interface GoldenFile {
  cases: GoldenCase[]
}
function loadGolden(): GoldenFile {
  const p = path.join(__dirname, '../__fixtures__/media_tech.golden.json')
  return JSON.parse(readFileSync(p, 'utf-8')) as GoldenFile
}

describe('MediaTech golden fixtures', () => {
  const golden = loadGolden()
  it.each(golden.cases.map((c) => [c.id, c] as const))('%s: golden一致', (_id, c) => {
    const result = evaluateMediaTech(c.input)
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

function buildInputs(overrides: Partial<MediaTechInputs> = {}): MediaTechInputs {
  return {
    mau: 2000000,
    mauGrowth: 0.2,
    growthDecayFactor: 0.85,
    dauMauRatio: 0.4,
    arpuMonthly: { ad: 100, paid: 50, commerce: 20 },
    monthlyChurn: 0.05,
    contentCostRatio: 0.3,
    cpa: 800,
    evSalesMultiple: { pessimistic: 3, base: 5, optimistic: 8 },
    projectionYears: 3,
    ...overrides,
  }
}

describe('MediaTech プロパティ', () => {
  it('mau = 0 ⇒ EV = 0', () => {
    const result = evaluateMediaTech(buildInputs({ mau: 0 }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.ev.base).toBeCloseTo(0, 9)
  })

  it('monthlyChurn = 0 ⇒ LTV系指標はキー自体省略', () => {
    const result = evaluateMediaTech(buildInputs({ monthlyChurn: 0 }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Object.keys(result.value.keyMetrics)).toEqual([])
  })

  it('P8: mauGrowth ↑ ⇒ EV 単調増加', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(-0.3), max: Math.fround(1), noNaN: true }),
        fc.float({ min: Math.fround(0.001), max: Math.fround(0.5), noNaN: true }),
        (g, delta) => {
          const r1 = evaluateMediaTech(buildInputs({ mauGrowth: g }))
          const r2 = evaluateMediaTech(buildInputs({ mauGrowth: g + delta }))
          expect(r1.ok && r2.ok).toBe(true)
          if (!r1.ok || !r2.ok) return
          expect(r2.value.ev.base).toBeGreaterThan(r1.value.ev.base)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('P15: レンジ順序 pessimistic ≤ base ≤ optimistic', () => {
    const result = evaluateMediaTech(buildInputs())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.ev.pessimistic).toBeLessThanOrEqual(result.value.ev.base + 1e-6)
    expect(result.value.ev.base).toBeLessThanOrEqual(result.value.ev.optimistic + 1e-6)
  })

  it('ltvCpaRatio は cpa > 0 のときのみ算出される', () => {
    const r1 = evaluateMediaTech(buildInputs({ cpa: 0 }))
    expect(r1.ok).toBe(true)
    if (!r1.ok) return
    expect(r1.value.keyMetrics.ltvCpaRatio).toBeUndefined()
    expect(r1.value.keyMetrics.avgLifetimeMonths).toBeDefined()
  })

  it('感度分析: δ=0でspan=0', () => {
    const inputs = buildInputs()
    const items = buildTornado(
      inputs,
      { delta: 0, driverIds: [...MEDIA_TECH_SENSITIVITY_DRIVERS] },
      applyMediaTechDriver,
      mediaTechBaseEv,
    )
    for (const item of items) expect(item.span).toBeCloseTo(0, 6)
  })

  const domainViolations: ((i: MediaTechInputs) => MediaTechInputs)[] = [
    (i) => ({ ...i, mau: -1 }),
    (i) => ({ ...i, mauGrowth: -1 }),
    (i) => ({ ...i, growthDecayFactor: 1.5 }),
    (i) => ({ ...i, growthDecayFactor: 0 }),
    (i) => ({ ...i, dauMauRatio: 1.5 }),
    (i) => ({ ...i, arpuMonthly: { ...i.arpuMonthly, ad: -1 } }),
    (i) => ({ ...i, monthlyChurn: 1.5 }),
    (i) => ({ ...i, contentCostRatio: -0.1 }),
    (i) => ({ ...i, cpa: -1 }),
    (i) => ({ ...i, evSalesMultiple: { ...i.evSalesMultiple, base: 0 } }),
    (i) => ({ ...i, projectionYears: 2.5 }),
  ]

  it('ドメイン外入力 → ok:false(§0.2.1)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...domainViolations), (corrupt) => {
        const result = evaluateMediaTech(corrupt(buildInputs()))
        expect(result.ok).toBe(false)
      }),
      { numRuns: 50 },
    )
  })
})
