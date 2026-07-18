import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { closeEnough } from '../types.ts'
import { buildWorkbenchCaseResult } from './valuation.ts'
import {
  workbenchClimateTechExit,
  workbenchDrugDiscoveryExit,
  workbenchEcD2cExit,
  workbenchMediaTechExit,
  workbenchMedicalDeviceExit,
  workbenchSaasExit,
} from './sectors.ts'
import type {
  WorkbenchCaseCoreInputs,
  WorkbenchCaseResult,
  WorkbenchClimateTechExitInputs,
  WorkbenchDrugDiscoveryExitInputs,
  WorkbenchEcD2cExitInputs,
  WorkbenchMediaTechExitInputs,
  WorkbenchMedicalDeviceExitInputs,
  WorkbenchSaasExitInputs,
} from './types.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

type WorkbenchSector =
  | 'saas_jp'
  | 'ec_d2c'
  | 'media_tech'
  | 'medical_device'
  | 'drug_discovery'
  | 'climate_tech'

interface GoldenCase {
  id: string
  tags: string[]
  input: {
    sector: WorkbenchSector
    exitInputs: Record<string, unknown>
    coreInputs: WorkbenchCaseCoreInputs
  }
  expected: WorkbenchCaseResult
}

interface GoldenFile {
  cases: GoldenCase[]
}

function loadGolden(): GoldenFile {
  const p = path.join(__dirname, '../__fixtures__/workbench.golden.json')
  return JSON.parse(readFileSync(p, 'utf-8')) as GoldenFile
}

function computeWorkbenchCase(input: GoldenCase['input']): WorkbenchCaseResult {
  switch (input.sector) {
    case 'saas_jp':
      return buildWorkbenchCaseResult(input.coreInputs, workbenchSaasExit(input.exitInputs as unknown as WorkbenchSaasExitInputs))
    case 'ec_d2c':
      return buildWorkbenchCaseResult(input.coreInputs, workbenchEcD2cExit(input.exitInputs as unknown as WorkbenchEcD2cExitInputs))
    case 'media_tech':
      return buildWorkbenchCaseResult(
        input.coreInputs,
        workbenchMediaTechExit(input.exitInputs as unknown as WorkbenchMediaTechExitInputs),
      )
    case 'medical_device':
      return buildWorkbenchCaseResult(
        input.coreInputs,
        workbenchMedicalDeviceExit(input.exitInputs as unknown as WorkbenchMedicalDeviceExitInputs),
      )
    case 'drug_discovery':
      return buildWorkbenchCaseResult(
        input.coreInputs,
        workbenchDrugDiscoveryExit(input.exitInputs as unknown as WorkbenchDrugDiscoveryExitInputs),
      )
    case 'climate_tech':
      return buildWorkbenchCaseResult(
        input.coreInputs,
        workbenchClimateTechExit(input.exitInputs as unknown as WorkbenchClimateTechExitInputs),
      )
  }
}

function expectNullableCloseEnough(actual: number | null | undefined, expected: number | null): void {
  if (expected === null) {
    expect(actual === null || actual === undefined).toBe(true)
    return
  }
  expect(actual === null || actual === undefined).toBe(false)
  expect(closeEnough(actual as number, expected)).toBe(true)
}

describe('V2 Workbench golden fixtures', () => {
  const golden = loadGolden()
  it.each(golden.cases.map((c) => [c.id, c] as const))('%s: golden一致', (_id, c) => {
    const result = computeWorkbenchCase(c.input)

    expect(result.exitMetricLabel).toBe(c.expected.exitMetricLabel)
    expect(closeEnough(result.exitMetric, c.expected.exitMetric)).toBe(true)
    expect(closeEnough(result.exitEnterpriseValue, c.expected.exitEnterpriseValue)).toBe(true)
    expect(closeEnough(result.exitEquityValue, c.expected.exitEquityValue)).toBe(true)
    expect(closeEnough(result.currentAllowablePostMoney, c.expected.currentAllowablePostMoney)).toBe(true)
    expect(closeEnough(result.currentAllowablePreMoney, c.expected.currentAllowablePreMoney)).toBe(true)
    expectNullableCloseEnough(result.theoreticalSharePrice, c.expected.theoreticalSharePrice)
    expect(closeEnough(result.requiredEntryOwnership, c.expected.requiredEntryOwnership)).toBe(true)
    expect(closeEnough(result.impliedTargetIrr, c.expected.impliedTargetIrr)).toBe(true)
    expectNullableCloseEnough(result.proposedPricePerShare, c.expected.proposedPricePerShare)
    expectNullableCloseEnough(result.valuationGapToProposed, c.expected.valuationGapToProposed)
    expect(closeEnough(result.expectedEntryOwnership, c.expected.expectedEntryOwnership)).toBe(true)
    expect(closeEnough(result.expectedExitOwnership, c.expected.expectedExitOwnership)).toBe(true)
    expect(closeEnough(result.expectedProceeds, c.expected.expectedProceeds)).toBe(true)
    expectNullableCloseEnough(result.expectedMoic, c.expected.expectedMoic)
    expectNullableCloseEnough(result.expectedIrr, c.expected.expectedIrr)
    expectNullableCloseEnough(result.intrinsicValue, c.expected.intrinsicValue ?? null)

    const actualKeys = Object.keys(result.diagnostics).sort()
    const expectedKeys = Object.keys(c.expected.diagnostics).sort()
    expect(actualKeys).toEqual(expectedKeys)
    for (const k of expectedKeys) {
      expect(closeEnough(result.diagnostics[k], c.expected.diagnostics[k])).toBe(true)
    }

    expect([...result.warnings].sort()).toEqual([...c.expected.warnings].sort())
  })
})

describe('V2 Workbench プロパティ(セクター別Exit評価)', () => {
  it('P18: arrGrowth ↑ ⇒ Exit企業価値 単調非減少(SaaS、ARR・マルチプルが正のとき)', () => {
    fc.assert(
      fc.property(
        fc.record({
          currentArr: fc.float({ min: Math.fround(0.01), max: Math.fround(5000), noNaN: true }),
          arrGrowth: fc.float({ min: Math.fround(-0.5), max: Math.fround(1), noNaN: true }),
          growthDecay: fc.float({ min: Math.fround(0.5), max: 1, noNaN: true }),
          exitOperatingMargin: fc.float({ min: Math.fround(-0.5), max: Math.fround(0.5), noNaN: true }),
          exitMultiple: fc.float({ min: Math.fround(0.01), max: Math.fround(15), noNaN: true }),
          yearsToExit: fc.integer({ min: 1, max: 10 }),
        }),
        fc.float({ min: Math.fround(0.001), max: Math.fround(0.5), noNaN: true }),
        (inputs, delta) => {
          const lower = workbenchSaasExit(inputs)
          const higher = workbenchSaasExit({ ...inputs, arrGrowth: inputs.arrGrowth + delta })
          expect(higher.exitEnterpriseValue).toBeGreaterThanOrEqual(lower.exitEnterpriseValue - 1e-6)
        },
      ),
      { numRuns: 100 },
    )
  })
})
