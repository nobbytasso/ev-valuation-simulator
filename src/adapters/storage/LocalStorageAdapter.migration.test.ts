// @vitest-environment jsdom
/**
 * D-1回帰テスト: Phase 2形式(schemaVersion/vcMethodなし)の永続化データが
 * ロード時(list/load)・インポート時(import)の両経路でクラッシュせず
 * 現行スキーマに移行されることを検証する(出典: docs/review-phase3.md D-1)。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { migrateScenario } from '../../store/scenarioMigration.ts'
import type { Scenario } from '../../store/scenarioTypes.ts'
import legacyScenarioV1 from '../../store/fixtures/legacy-scenario-v1.json'
import { LocalStorageAdapter } from './LocalStorageAdapter.ts'

const KEY = 'test:migration:scenarios:v1'

beforeEach(() => {
  window.localStorage.clear()
})

describe('LocalStorageAdapter + migrateScenario(ロード経路)', () => {
  it('Phase2形式の生データをlist()でロードすると移行済みの形になる', async () => {
    window.localStorage.setItem(KEY, JSON.stringify([legacyScenarioV1]))
    const adapter = new LocalStorageAdapter<Scenario>(KEY, migrateScenario)

    const list = await adapter.list()

    expect(list).toHaveLength(1)
    expect(list[0].schemaVersion).toBe(2)
    expect(list[0].vcMethod).toBeDefined()
    expect(list[0].id).toBe('legacy-saas-0001')
  })

  it('load(id)でも移行済みの形で返る', async () => {
    window.localStorage.setItem(KEY, JSON.stringify([legacyScenarioV1]))
    const adapter = new LocalStorageAdapter<Scenario>(KEY, migrateScenario)

    const item = await adapter.load('legacy-saas-0001')

    expect(item).not.toBeNull()
    expect(item?.vcMethod).toBeDefined()
  })

  it('新旧混在の配列でもクラッシュせず全件ロードできる', async () => {
    const currentShape: Scenario = migrateScenario({
      ...legacyScenarioV1,
      id: 'already-v2',
      schemaVersion: 2,
      vcMethod: { targetMultiple: 7, yearsToExit: 3, investment: 200, dilutionRetention: 0.5, netDebtAtExit: 0 },
    })
    window.localStorage.setItem(KEY, JSON.stringify([legacyScenarioV1, currentShape]))
    const adapter = new LocalStorageAdapter<Scenario>(KEY, migrateScenario)

    const list = await adapter.list()

    expect(list).toHaveLength(2)
    expect(list.every((s) => s.schemaVersion === 2 && s.vcMethod !== undefined)).toBe(true)
  })

  it('1件が移行不能な破損データでも他の正常な項目のロードは継続する', async () => {
    window.localStorage.setItem(KEY, JSON.stringify([legacyScenarioV1, null, 'not-an-object']))
    const adapter = new LocalStorageAdapter<Scenario>(KEY, migrateScenario)

    const list = await adapter.list()

    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('legacy-saas-0001')
  })
})

describe('LocalStorageAdapter + migrateScenario(インポート経路)', () => {
  it('Phase2形式のJSON文字列をimport()すると移行済みの形で保存される', async () => {
    const adapter = new LocalStorageAdapter<Scenario>(KEY, migrateScenario)

    const imported = await adapter.import(JSON.stringify(legacyScenarioV1))

    expect(imported.schemaVersion).toBe(2)
    expect(imported.vcMethod).toBeDefined()
    expect(imported.id).not.toBe('legacy-saas-0001') // importは新規IDを採番する

    const persisted = await adapter.list()
    expect(persisted).toHaveLength(1)
    expect(persisted[0].vcMethod).toBeDefined()
  })
})
