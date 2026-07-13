/**
 * シナリオ管理のZustandストア。
 * 出典: docs/requirements-rev4.md §4.1.1(作成・保存・複製・命名・削除)
 *
 * StorageAdapter を注入可能にすることで、Stage 2 の DriveAdapter への差し替えや
 * テスト時の独立したストレージキー利用を可能にする。
 */
import { create } from 'zustand'
import { LocalStorageAdapter } from '../adapters/storage/LocalStorageAdapter.ts'
import type { StorageAdapter } from '../adapters/storage/StorageAdapter.ts'
import { createScenario } from './defaultInputs.ts'
import { migrateScenario } from './scenarioMigration.ts'
import type { Scenario, SectorId } from './scenarioTypes.ts'

export const SCENARIO_STORAGE_KEY = 'ev-valuation-simulator:scenarios:v1'

export interface ScenarioStoreState {
  scenarios: Scenario[]
  isLoaded: boolean
  loadAll: () => Promise<void>
  create: (sector: SectorId, name?: string) => Promise<Scenario>
  save: (scenario: Scenario) => Promise<void>
  duplicate: (id: string) => Promise<Scenario | null>
  rename: (id: string, name: string) => Promise<void>
  remove: (id: string) => Promise<void>
  exportToJson: (id: string) => Promise<string>
  importFromJson: (json: string) => Promise<Scenario>
}

/** テスト等で独立したStorageAdapterを注入したいときに使うストアファクトリ。 */
export function createScenarioStore(adapter: StorageAdapter<Scenario>) {
  return create<ScenarioStoreState>((set, get) => ({
    scenarios: [],
    isLoaded: false,

    loadAll: async () => {
      const scenarios = await adapter.list()
      set({ scenarios, isLoaded: true })
    },

    create: async (sector, name) => {
      const scenario = createScenario(sector, name ?? `新規シナリオ(${new Date().toLocaleDateString('ja-JP')})`)
      await adapter.save(scenario)
      set({ scenarios: [...get().scenarios, scenario] })
      return scenario
    },

    save: async (scenario) => {
      const updated: Scenario = { ...scenario, updatedAt: new Date().toISOString() }
      await adapter.save(updated)
      set({
        scenarios: get().scenarios.some((s) => s.id === updated.id)
          ? get().scenarios.map((s) => (s.id === updated.id ? updated : s))
          : [...get().scenarios, updated],
      })
    },

    duplicate: async (id) => {
      const original = get().scenarios.find((s) => s.id === id)
      if (!original) return null
      const now = new Date().toISOString()
      const copy: Scenario = {
        ...original,
        id: crypto.randomUUID(),
        name: `${original.name}(コピー)`,
        createdAt: now,
        updatedAt: now,
      }
      await adapter.save(copy)
      set({ scenarios: [...get().scenarios, copy] })
      return copy
    },

    rename: async (id, name) => {
      const target = get().scenarios.find((s) => s.id === id)
      if (!target) return
      const updated: Scenario = { ...target, name, updatedAt: new Date().toISOString() }
      await adapter.save(updated)
      set({ scenarios: get().scenarios.map((s) => (s.id === id ? updated : s)) })
    },

    remove: async (id) => {
      await adapter.delete(id)
      set({ scenarios: get().scenarios.filter((s) => s.id !== id) })
    },

    exportToJson: async (id) => adapter.export(id),

    importFromJson: async (json) => {
      const imported = await adapter.import(json)
      set({ scenarios: [...get().scenarios, imported] })
      return imported
    },
  }))
}

/** アプリ全体で使う既定のシナリオストア(localStorage バックエンド、スキーマ移行対応)。 */
export const useScenarioStore = createScenarioStore(
  new LocalStorageAdapter<Scenario>(SCENARIO_STORAGE_KEY, migrateScenario),
)
