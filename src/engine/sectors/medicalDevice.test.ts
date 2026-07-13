import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { closeEnough } from '../types.ts'
import {
  applyMedicalDeviceDriver,
  evaluateMedicalDevice,
  MEDICAL_DEVICE_SENSITIVITY_DRIVERS,
  medicalDeviceBaseEv,
} from './medicalDevice.ts'
import type { MedicalDeviceInputs } from './medicalDevice.ts'
import { buildTornado } from '../common/sensitivity.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface GoldenCase {
  id: string
  tags: string[]
  input: MedicalDeviceInputs
  expected: { ev: { pessimistic: number; base: number; optimistic: number }; keyMetrics: Record<string, number> }
}
interface GoldenFile {
  cases: GoldenCase[]
}
function loadGolden(): GoldenFile {
  const p = path.join(__dirname, '../__fixtures__/medical_device.golden.json')
  return JSON.parse(readFileSync(p, 'utf-8')) as GoldenFile
}

describe('MedicalDevice golden fixtures', () => {
  const golden = loadGolden()
  it.each(golden.cases.map((c) => [c.id, c] as const))('%s: golden一致', (_id, c) => {
    const result = evaluateMedicalDevice(c.input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(closeEnough(result.value.ev.pessimistic, c.expected.ev.pessimistic)).toBe(true)
    expect(closeEnough(result.value.ev.base, c.expected.ev.base)).toBe(true)
    expect(closeEnough(result.value.ev.optimistic, c.expected.ev.optimistic)).toBe(true)
  })
})

function buildInputs(overrides: Partial<MedicalDeviceInputs> = {}): MedicalDeviceInputs {
  return {
    annualProcedures: 5000,
    procedureGrowth: 0.02,
    deviceClass: 'II',
    launchYear: 2,
    approvalDelayYears: 0,
    pricePerProcedure: 150000,
    peakPenetration: 0.3,
    yearsToPeak: 4,
    recurringRatio: 0.2,
    operatingMargin: 0.15,
    discountRate: { pessimistic: 0.14, base: 0.12, optimistic: 0.1 },
    projectionYears: 10,
    terminalGrowth: 0.02,
    ...overrides,
  }
}

describe('MedicalDevice プロパティ', () => {
  it('annualProcedures = 0 または peakPenetration = 0 ⇒ EV = 0', () => {
    const r1 = evaluateMedicalDevice(buildInputs({ annualProcedures: 0 }))
    const r2 = evaluateMedicalDevice(buildInputs({ peakPenetration: 0 }))
    expect(r1.ok && r2.ok).toBe(true)
    if (!r1.ok || !r2.ok) return
    expect(r1.value.ev.base).toBeCloseTo(0, 9)
    expect(r2.value.ev.base).toBeCloseTo(0, 9)
  })

  it('P6: approvalDelayYears ↑ ⇒ EV 単調非増加', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 0, max: 5 }),
        fc.float({ min: Math.fround(0.05), max: Math.fround(0.5), noNaN: true }),
        (d1, d2, peakPenetration) => {
          const lo = Math.min(d1, d2)
          const hi = Math.max(d1, d2)
          const r1 = evaluateMedicalDevice(buildInputs({ approvalDelayYears: lo, peakPenetration }))
          const r2 = evaluateMedicalDevice(buildInputs({ approvalDelayYears: hi, peakPenetration }))
          expect(r1.ok && r2.ok).toBe(true)
          if (!r1.ok || !r2.ok) return
          expect(r2.value.ev.base).toBeLessThanOrEqual(r1.value.ev.base + 1e-6)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('P7: peakPenetration に対して EV 単調非減少', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: Math.fround(0.5), noNaN: true }),
        fc.float({ min: 0, max: Math.fround(0.5), noNaN: true }),
        (p1, p2) => {
          const lo = Math.min(p1, p2)
          const hi = Math.max(p1, p2)
          const r1 = evaluateMedicalDevice(buildInputs({ peakPenetration: lo }))
          const r2 = evaluateMedicalDevice(buildInputs({ peakPenetration: hi }))
          expect(r1.ok && r2.ok).toBe(true)
          if (!r1.ok || !r2.ok) return
          expect(r2.value.ev.base).toBeGreaterThanOrEqual(r1.value.ev.base - 1e-6)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('P15: レンジ順序 pessimistic ≤ base ≤ optimistic', () => {
    const result = evaluateMedicalDevice(buildInputs())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.ev.pessimistic).toBeLessThanOrEqual(result.value.ev.base + 1e-6)
    expect(result.value.ev.base).toBeLessThanOrEqual(result.value.ev.optimistic + 1e-6)
  })

  it('recurringRatio >= 1 は ValidationIssue(発散)', () => {
    const result = evaluateMedicalDevice(buildInputs({ recurringRatio: 1 }))
    expect(result.ok).toBe(false)
  })

  it('感度分析: δ=0でspan=0', () => {
    const inputs = buildInputs()
    const items = buildTornado(
      inputs,
      { delta: 0, driverIds: [...MEDICAL_DEVICE_SENSITIVITY_DRIVERS] },
      applyMedicalDeviceDriver,
      medicalDeviceBaseEv,
    )
    for (const item of items) expect(item.span).toBeCloseTo(0, 6)
  })

  const domainViolations: ((i: MedicalDeviceInputs) => MedicalDeviceInputs)[] = [
    (i) => ({ ...i, annualProcedures: -1 }),
    (i) => ({ ...i, procedureGrowth: -1 }),
    (i) => ({ ...i, approvalDelayYears: -1 }),
    (i) => ({ ...i, approvalDelayYears: 1.5 }),
    (i) => ({ ...i, pricePerProcedure: -1 }),
    (i) => ({ ...i, peakPenetration: 1.5 }),
    (i) => ({ ...i, yearsToPeak: 0 }),
    (i) => ({ ...i, recurringRatio: 1.5 }),
    (i) => ({ ...i, projectionYears: 2.5 }),
    (i) => ({ ...i, discountRate: { ...i.discountRate, base: 0 } }),
  ]

  it('ドメイン外入力 → ok:false(§0.2.1)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...domainViolations), (corrupt) => {
        const result = evaluateMedicalDevice(corrupt(buildInputs()))
        expect(result.ok).toBe(false)
      }),
      { numRuns: 50 },
    )
  })
})
