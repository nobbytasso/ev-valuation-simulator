import { describe, expect, it } from 'vitest'
import { MIGRATION_CASE_FACTORS, migrateLegacyScenario } from './legacyMigration.ts'
import type { MigrationCaseFactors } from './legacyMigration.ts'

const legacySaasScenario = {
  sector: 'saas_jp',
  name: 'Legacy SaaS Co.',
  inputs: {
    arr: 1000,
    arrGrowth: 0.2,
    evArrMultiple: { pessimistic: 4, base: 7, optimistic: 10 },
  },
  vcMethod: {
    targetMultiple: 8,
    yearsToExit: 5,
    investment: 300,
    dilutionRetention: 0.7,
    netDebtAtExit: 0,
  },
}

describe('migrateLegacyScenario', () => {
  it('既定係数(MIGRATION_CASE_FACTORS)で従来と同値に展開する(SaaS)', () => {
    const state = migrateLegacyScenario(legacySaasScenario)
    const [plan, underwriting, downside, severe] = state.cases

    expect(plan.assumptions.arrGrowth).toBeCloseTo(0.2 * 1.2)
    expect(underwriting.assumptions.arrGrowth).toBeCloseTo(0.2 * 1)
    expect(downside.assumptions.arrGrowth).toBeCloseTo(0.2 * 0.55)
    expect(severe.assumptions.arrGrowth).toBeCloseTo(0.2 * 0.15)

    expect(plan.assumptions.exitMultiple).toBe(10)
    expect(underwriting.assumptions.exitMultiple).toBe(7)
    expect(downside.assumptions.exitMultiple).toBe(4)
    expect(severe.assumptions.exitMultiple).toBeCloseTo(4 * 0.65)
  })

  it('係数を編集すると展開結果に反映される(SaaS growthFactor)', () => {
    const customFactors: MigrationCaseFactors = {
      ...MIGRATION_CASE_FACTORS,
      saas_jp: {
        ...MIGRATION_CASE_FACTORS.saas_jp,
        growthFactor: [2, 1, 0.5, 0],
      },
    }
    const state = migrateLegacyScenario(legacySaasScenario, customFactors)
    const [plan, underwriting, downside, severe] = state.cases

    expect(plan.assumptions.arrGrowth).toBeCloseTo(0.2 * 2)
    expect(underwriting.assumptions.arrGrowth).toBeCloseTo(0.2 * 1)
    expect(downside.assumptions.arrGrowth).toBeCloseTo(0.2 * 0.5)
    expect(severe.assumptions.arrGrowth).toBeCloseTo(0)
  })

  it('係数を編集するとSevere Downsideのマルチプルにも反映される(SaaS severeMultipleFactor)', () => {
    const customFactors: MigrationCaseFactors = {
      ...MIGRATION_CASE_FACTORS,
      saas_jp: {
        ...MIGRATION_CASE_FACTORS.saas_jp,
        severeMultipleFactor: 0.9,
      },
    }
    const state = migrateLegacyScenario(legacySaasScenario, customFactors)
    expect(state.cases[3].assumptions.exitMultiple).toBeCloseTo(4 * 0.9)
  })

  it('未知のセクターは例外を投げる', () => {
    expect(() => migrateLegacyScenario({ sector: 'unknown', inputs: {} })).toThrow()
  })

  it('inputsが無い場合は例外を投げる', () => {
    expect(() => migrateLegacyScenario({ sector: 'saas_jp' })).toThrow()
  })
})
