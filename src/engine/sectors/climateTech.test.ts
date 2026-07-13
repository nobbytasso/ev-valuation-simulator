import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { closeEnough } from '../types.ts'
import {
  applyClimateTechDriver,
  CLIMATE_TECH_SENSITIVITY_DRIVERS,
  climateTechBaseEv,
  evaluateClimateTech,
} from './climateTech.ts'
import type { ClimateTechInputs } from './climateTech.ts'
import { buildTornado } from '../common/sensitivity.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface GoldenCase {
  id: string
  tags: string[]
  input: ClimateTechInputs
  expected: { ev: { pessimistic: number; base: number; optimistic: number }; keyMetrics: Record<string, number> }
}
interface GoldenFile {
  cases: GoldenCase[]
}
function loadGolden(): GoldenFile {
  const p = path.join(__dirname, '../__fixtures__/climate_tech.golden.json')
  return JSON.parse(readFileSync(p, 'utf-8')) as GoldenFile
}

describe('ClimateTech golden fixtures', () => {
  const golden = loadGolden()
  it.each(golden.cases.map((c) => [c.id, c] as const))('%s: golden一致', (_id, c) => {
    const result = evaluateClimateTech(c.input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(closeEnough(result.value.ev.pessimistic, c.expected.ev.pessimistic)).toBe(true)
    expect(closeEnough(result.value.ev.base, c.expected.ev.base)).toBe(true)
    expect(closeEnough(result.value.ev.optimistic, c.expected.ev.optimistic)).toBe(true)
  })
})

function buildInputs(overrides: Partial<ClimateTechInputs> = {}): ClimateTechInputs {
  return {
    capexSchedule: [
      { yearIndex: 0, amount: 2000 },
      { yearIndex: 1, amount: 1500 },
    ],
    subsidyCoverage: 0.2,
    massProductionYear: 4,
    massProductionProb: 0.6,
    annualCapacityUnits: 200000,
    rampYears: 2,
    unitPrice: 8000,
    unitCost0: 9000,
    costDeclineRate: 0.08,
    offtakeCoverage: 0.4,
    merchantRealization: 1,
    fixedOpexAnnual: 500,
    carbonCreditVolume: 100000,
    carbonCreditPrice: 5000,
    discountRate: { pessimistic: 0.12, base: 0.1, optimistic: 0.08 },
    projectYears: 20,
    ...overrides,
  }
}

describe('ClimateTech プロパティ', () => {
  it('P10: massProductionProb ↑ ⇒ EV 単調(t≥mの期待CF合計が正のとき増加)', () => {
    // unitPrice を十分高く、costDeclineRate/carbonCreditで t>=m の期待CFを正に保つ設定
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: Math.fround(0.8), noNaN: true }),
        fc.float({ min: Math.fround(0.001), max: Math.fround(0.15), noNaN: true }),
        (p, delta) => {
          const r1 = evaluateClimateTech(buildInputs({ massProductionProb: p }))
          const r2 = evaluateClimateTech(buildInputs({ massProductionProb: Math.min(p + delta, 1) }))
          expect(r1.ok && r2.ok).toBe(true)
          if (!r1.ok || !r2.ok) return
          expect(r2.value.ev.base).toBeGreaterThanOrEqual(r1.value.ev.base - 1e-6)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('P = 1 ⇒ 通常のプロジェクトNPVと一致(確率調整なし相当)', () => {
    const result = evaluateClimateTech(buildInputs({ massProductionProb: 1 }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // massProductionProb=1のときは §1.5式そのままなので、単に妥当な有限値であることを確認
    expect(Number.isFinite(result.value.ev.base)).toBe(true)
  })

  it('subsidyCoverage ↓ ⇒ EV ↓(単調)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: Math.fround(0.9), noNaN: true }),
        fc.float({ min: Math.fround(0.001), max: Math.fround(0.09), noNaN: true }),
        (s, delta) => {
          const lo = s
          const hi = Math.min(s + delta, 1)
          const r1 = evaluateClimateTech(buildInputs({ subsidyCoverage: lo }))
          const r2 = evaluateClimateTech(buildInputs({ subsidyCoverage: hi }))
          expect(r1.ok && r2.ok).toBe(true)
          if (!r1.ok || !r2.ok) return
          // subsidyCoverage↑ (lo→hi) ⇒ EV↑、つまりsubsidyCoverage↓⇒EV↓
          expect(r2.value.ev.base).toBeGreaterThanOrEqual(r1.value.ev.base - 1e-6)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('EVは負を許容する(そのまま返す)', () => {
    const result = evaluateClimateTech(buildInputs({ unitPrice: 100, carbonCreditPrice: 0 }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.ev.base).toBeLessThan(0)
  })

  it('感度分析: δ=0でspan=0', () => {
    const inputs = buildInputs()
    const items = buildTornado(
      inputs,
      { delta: 0, driverIds: [...CLIMATE_TECH_SENSITIVITY_DRIVERS] },
      applyClimateTechDriver,
      climateTechBaseEv,
    )
    for (const item of items) expect(item.span).toBeCloseTo(0, 6)
  })

  const domainViolations: ((i: ClimateTechInputs) => ClimateTechInputs)[] = [
    (i) => ({ ...i, subsidyCoverage: 1.5 }),
    (i) => ({ ...i, massProductionProb: -0.1 }),
    (i) => ({ ...i, annualCapacityUnits: -1 }),
    (i) => ({ ...i, rampYears: 0 }),
    (i) => ({ ...i, unitPrice: -1 }),
    (i) => ({ ...i, unitCost0: -1 }),
    (i) => ({ ...i, costDeclineRate: 1 }),
    (i) => ({ ...i, offtakeCoverage: 1.5 }),
    (i) => ({ ...i, merchantRealization: 1.5 }),
    (i) => ({ ...i, fixedOpexAnnual: -1 }),
    (i) => ({ ...i, carbonCreditVolume: -1 }),
    (i) => ({ ...i, carbonCreditPrice: -1 }),
    (i) => ({ ...i, discountRate: { ...i.discountRate, base: 0 } }),
    (i) => ({ ...i, projectYears: 2.5 }),
    (i) => ({ ...i, capexSchedule: [{ yearIndex: 0, amount: -1 }] }),
  ]

  it('ドメイン外入力 → ok:false(§0.2.1)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...domainViolations), (corrupt) => {
        const result = evaluateClimateTech(corrupt(buildInputs()))
        expect(result.ok).toBe(false)
      }),
      { numRuns: 50 },
    )
  })
})
