import { describe, expect, it } from 'vitest'
import { evaluateSaas } from '../engine/index.ts'
import legacyScenarioV1 from './fixtures/legacy-scenario-v1.json'
import { migrateScenario } from './scenarioMigration.ts'
import { SCENARIO_SCHEMA_VERSION } from './scenarioTypes.ts'

describe('migrateScenario', () => {
  it('Phase 2形式(v1, vcMethod/schemaVersionなし)のシナリオをv2に移行する', () => {
    // fixture自体がPhase 2形式であること(回帰対象)を確認
    expect(legacyScenarioV1).not.toHaveProperty('vcMethod')
    expect(legacyScenarioV1).not.toHaveProperty('schemaVersion')

    const migrated = migrateScenario(legacyScenarioV1)

    expect(migrated.schemaVersion).toBe(SCENARIO_SCHEMA_VERSION)
    expect(migrated.vcMethod).toEqual({
      targetMultiple: 10,
      yearsToExit: 5,
      investment: 300,
      dilutionRetention: 0.7,
      netDebtAtExit: 0,
    })
    // 既存フィールドは保持される
    expect(migrated.id).toBe('legacy-saas-0001')
    expect(migrated.name).toBe('Phase2形式レガシーシナリオ(SaaS)')
    expect(migrated.sector).toBe('saas_jp')
    expect(migrated.createdAt).toBe('2026-07-13T10:00:00.000Z')
  })

  it('移行後のシナリオはエンジンにそのまま渡せる(クラッシュしない)', () => {
    const migrated = migrateScenario(legacyScenarioV1)
    if (migrated.sector !== 'saas_jp') throw new Error('unreachable')
    const result = evaluateSaas(migrated.inputs)
    expect(result.ok).toBe(true)
  })

  it('既にv2(vcMethod・schemaVersionあり)のシナリオはそのまま返す(冪等)', () => {
    const current = {
      id: 'v2-scenario',
      name: '現行シナリオ',
      sector: 'saas_jp',
      inputs: (legacyScenarioV1 as { inputs: unknown }).inputs,
      vcMethod: {
        targetMultiple: 8,
        yearsToExit: 4,
        investment: 500,
        dilutionRetention: 0.6,
        netDebtAtExit: 100,
      },
      schemaVersion: SCENARIO_SCHEMA_VERSION,
      createdAt: '2026-07-13T00:00:00.000Z',
      updatedAt: '2026-07-13T00:00:00.000Z',
    }

    const migrated = migrateScenario(current)

    expect(migrated.vcMethod).toEqual(current.vcMethod) // 上書きされない
    expect(migrated.schemaVersion).toBe(SCENARIO_SCHEMA_VERSION)
  })

  it('オブジェクトでない入力は例外を投げる', () => {
    expect(() => migrateScenario(null)).toThrow()
    expect(() => migrateScenario('not an object')).toThrow()
    expect(() => migrateScenario(42)).toThrow()
  })
})
