import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { closeEnough } from '../types.ts'
import { applySaasDriver, evaluateSaas, SAAS_SENSITIVITY_DRIVERS, saasBaseEv } from './saas.ts'
import type { SaasInputs } from './saas.ts'
import { buildTornado } from '../common/sensitivity.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface GoldenCase {
  id: string
  tags: string[]
  input: SaasInputs
  expected: {
    ev: { pessimistic: number; base: number; optimistic: number }
    auxiliary?: number
    keyMetrics: Record<string, number>
  }
}

interface GoldenFile {
  cases: GoldenCase[]
}

function loadGolden(): GoldenFile {
  const p = path.join(__dirname, '../__fixtures__/saas_jp.golden.json')
  return JSON.parse(readFileSync(p, 'utf-8')) as GoldenFile
}

describe('SaaS golden fixtures', () => {
  const golden = loadGolden()
  it.each(golden.cases.map((c) => [c.id, c] as const))('%s: golden一致', (_id, c) => {
    const result = evaluateSaas(c.input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(closeEnough(result.value.ev.pessimistic, c.expected.ev.pessimistic)).toBe(true)
    expect(closeEnough(result.value.ev.base, c.expected.ev.base)).toBe(true)
    expect(closeEnough(result.value.ev.optimistic, c.expected.ev.optimistic)).toBe(true)
    if (c.expected.auxiliary !== undefined) {
      expect(result.value.auxiliary).toBeDefined()
      expect(closeEnough(result.value.auxiliary as number, c.expected.auxiliary)).toBe(true)
    }
    const actualKeys = Object.keys(result.value.keyMetrics).sort()
    const expectedKeys = Object.keys(c.expected.keyMetrics).sort()
    expect(actualKeys).toEqual(expectedKeys)
    for (const k of expectedKeys) {
      expect(closeEnough(result.value.keyMetrics[k], c.expected.keyMetrics[k])).toBe(true)
    }
  })
})

const validInputsArb: fc.Arbitrary<SaasInputs> = fc
  .record({
    arr: fc.float({ min: 0, max: Math.fround(100000), noNaN: true }),
    arrGrowth: fc.float({ min: Math.fround(-0.5), max: Math.fround(3), noNaN: true }),
    nrr: fc.float({ min: Math.fround(0.5), max: Math.fround(1.5), noNaN: true }),
    grossMargin: fc.float({ min: 0, max: 1, noNaN: true }),
    operatingMargin: fc.float({ min: Math.fround(-1), max: 1, noNaN: true }),
    fcfMargin: fc.float({ min: Math.fround(-1), max: 1, noNaN: true }),
    grossChurn: fc.float({ min: 0, max: 1, noNaN: true }),
    cacPaybackMonths: fc.float({ min: Math.fround(1), max: Math.fround(60), noNaN: true }),
    arrBasis: fc.constantFrom<'current' | 'ntm'>('current', 'ntm'),
    projectionYears: fc.integer({ min: 1, max: 10 }),
    growthDecayFactor: fc.float({ min: Math.fround(0.5), max: 1, noNaN: true }),
    terminalGrowth: fc.float({ min: 0, max: Math.fround(0.03), noNaN: true }),
    discountRateDelta: fc.float({ min: Math.fround(0.01), max: Math.fround(0.3), noNaN: true }),
    m1: fc.float({ min: Math.fround(1), max: Math.fround(5), noNaN: true }),
    m2: fc.float({ min: Math.fround(0), max: Math.fround(5), noNaN: true }),
    m3: fc.float({ min: Math.fround(0), max: Math.fround(5), noNaN: true }),
  })
  .map((r) => ({
    arr: r.arr,
    arrGrowth: r.arrGrowth,
    nrr: r.nrr,
    grossMargin: r.grossMargin,
    operatingMargin: r.operatingMargin,
    fcfMargin: r.fcfMargin,
    grossChurn: r.grossChurn,
    cacPaybackMonths: r.cacPaybackMonths,
    arrBasis: r.arrBasis,
    evArrMultiple: {
      pessimistic: r.m1,
      base: r.m1 + r.m2,
      optimistic: r.m1 + r.m2 + r.m3,
    },
    projectionYears: r.projectionYears,
    growthDecayFactor: r.growthDecayFactor,
    discountRate: r.terminalGrowth + r.discountRateDelta,
    terminalGrowth: r.terminalGrowth,
  }))

describe('SaaS プロパティ', () => {
  it('P3: arr = 0 ⇒ 全EVおよびauxiliary = 0', () => {
    fc.assert(
      fc.property(validInputsArb, (inputs) => {
        const result = evaluateSaas({ ...inputs, arr: 0 })
        expect(result.ok).toBe(true)
        if (!result.ok) return
        expect(result.value.ev.pessimistic).toBeCloseTo(0, 9)
        expect(result.value.ev.base).toBeCloseTo(0, 9)
        expect(result.value.ev.optimistic).toBeCloseTo(0, 9)
        expect(result.value.auxiliary).toBeCloseTo(0, 9)
      }),
      { numRuns: 100 },
    )
  })

  it('P2: arrGrowth ↑ ⇒ EV(ntm基準) 単調増加(マルチプル・ARRが正のとき)', () => {
    fc.assert(
      fc.property(
        validInputsArb,
        fc.float({ min: Math.fround(0.001), max: Math.fround(0.5), noNaN: true }),
        (inputs, delta) => {
          fc.pre(inputs.arr > 0)
          const base = { ...inputs, arrBasis: 'ntm' as const }
          const higher = { ...base, arrGrowth: base.arrGrowth + delta }
          const r1 = evaluateSaas(base)
          const r2 = evaluateSaas(higher)
          expect(r1.ok && r2.ok).toBe(true)
          if (!r1.ok || !r2.ok) return
          expect(r2.value.ev.base).toBeGreaterThanOrEqual(r1.value.ev.base - 1e-6)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('P2: arrGrowth ↑ ⇒ EV_dcf 単調増加(fcfMargin > 0 のとき)', () => {
    fc.assert(
      fc.property(
        validInputsArb,
        fc.float({ min: Math.fround(0.001), max: Math.fround(0.3), noNaN: true }),
        (inputs, delta) => {
          fc.pre(inputs.arr > 0 && inputs.fcfMargin > 0 && inputs.arrGrowth + delta < 3)
          const higher = { ...inputs, arrGrowth: inputs.arrGrowth + delta }
          const r1 = evaluateSaas(inputs)
          const r2 = evaluateSaas(higher)
          expect(r1.ok && r2.ok).toBe(true)
          if (!r1.ok || !r2.ok) return
          expect(r2.value.auxiliary ?? 0).toBeGreaterThanOrEqual((r1.value.auxiliary ?? 0) - 1e-6)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('P15: レンジ順序 pessimistic ≤ base ≤ optimistic(入力レンジが順序整合のとき)', () => {
    fc.assert(
      fc.property(validInputsArb, (inputs) => {
        const result = evaluateSaas(inputs)
        expect(result.ok).toBe(true)
        if (!result.ok) return
        expect(result.value.ev.pessimistic).toBeLessThanOrEqual(result.value.ev.base + 1e-6)
        expect(result.value.ev.base).toBeLessThanOrEqual(result.value.ev.optimistic + 1e-6)
      }),
      { numRuns: 100 },
    )
  })

  it('ruleOf40 = (arrGrowth + operatingMargin) × 100', () => {
    fc.assert(
      fc.property(validInputsArb, (inputs) => {
        const result = evaluateSaas(inputs)
        expect(result.ok).toBe(true)
        if (!result.ok) return
        expect(result.value.keyMetrics.ruleOf40).toBeCloseTo((inputs.arrGrowth + inputs.operatingMargin) * 100, 6)
      }),
      { numRuns: 50 },
    )
  })

  it('r ≤ terminalGrowth は ValidationIssue', () => {
    const result = evaluateSaas({
      arr: 1000,
      arrGrowth: 0.1,
      nrr: 1.1,
      grossMargin: 0.7,
      operatingMargin: 0.1,
      fcfMargin: 0.1,
      grossChurn: 0.1,
      cacPaybackMonths: 12,
      arrBasis: 'ntm',
      evArrMultiple: { pessimistic: 5, base: 8, optimistic: 12 },
      projectionYears: 5,
      growthDecayFactor: 0.85,
      discountRate: 0.02,
      terminalGrowth: 0.02,
    })
    expect(result.ok).toBe(false)
  })

  it('感度分析 δ=0 で span=0、SAAS_SENSITIVITY_DRIVERSが妥当に動く', () => {
    const inputs: SaasInputs = {
      arr: 1000,
      arrGrowth: 0.3,
      nrr: 1.1,
      grossMargin: 0.7,
      operatingMargin: 0.1,
      fcfMargin: 0.1,
      grossChurn: 0.1,
      cacPaybackMonths: 12,
      arrBasis: 'ntm',
      evArrMultiple: { pessimistic: 5, base: 8, optimistic: 12 },
      projectionYears: 5,
      growthDecayFactor: 0.85,
      discountRate: 0.12,
      terminalGrowth: 0.02,
    }
    const items = buildTornado(
      inputs,
      { delta: 0, driverIds: [...SAAS_SENSITIVITY_DRIVERS] },
      applySaasDriver,
      saasBaseEv,
    )
    for (const item of items) expect(item.span).toBeCloseTo(0, 6)

    const itemsWithDelta = buildTornado(
      inputs,
      { delta: 0.2, driverIds: [...SAAS_SENSITIVITY_DRIVERS] },
      applySaasDriver,
      saasBaseEv,
    )
    expect(itemsWithDelta.length).toBe(SAAS_SENSITIVITY_DRIVERS.length)
    expect(itemsWithDelta.every((item) => item.span >= 0)).toBe(true)
  })
})
