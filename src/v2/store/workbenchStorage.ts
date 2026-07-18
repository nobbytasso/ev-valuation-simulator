import type { WorkbenchState } from '../domain/types.ts'
import { createDefaultWorkbench } from '../domain/sectorDefinitions.ts'
import { MIGRATION_CASE_FACTORS, migrateLegacyScenario } from './legacyMigration.ts'
import type { MigrationCaseFactors } from './legacyMigration.ts'

export const WORKBENCH_STORAGE_KEY = 'ev-valuation-simulator:workbench:v2'

function isWorkbenchState(value: unknown): value is WorkbenchState {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return record.schemaVersion === 2 && typeof record.company === 'object' && Array.isArray(record.cases)
}

export function loadWorkbench(): WorkbenchState {
  try {
    const saved = localStorage.getItem(WORKBENCH_STORAGE_KEY)
    if (!saved) return createDefaultWorkbench()
    const parsed: unknown = JSON.parse(saved)
    return isWorkbenchState(parsed) ? parsed : createDefaultWorkbench()
  } catch {
    return createDefaultWorkbench()
  }
}

export function saveWorkbench(state: WorkbenchState): void {
  localStorage.setItem(
    WORKBENCH_STORAGE_KEY,
    JSON.stringify({ ...state, updatedAt: new Date().toISOString() }),
  )
}

export function importWorkbenchJson(json: string): WorkbenchState {
  const parsed: unknown = JSON.parse(json)
  if (isWorkbenchState(parsed)) return parsed
  return migrateLegacyScenario(parsed)
}

export interface WorkbenchImportResult {
  state: WorkbenchState
  /** 旧Scenario形式から移行した場合の生JSON(移行係数パネルの「この係数で再展開」用)。移行不要ならnull。 */
  legacyRaw: unknown | null
}

/**
 * インポートJSONを解析し、旧Scenario形式からの移行だった場合は生データも返す
 * (`docs/v2-adoption-spec.md` §3、裁定③「移行係数」編集パネル用)。
 */
export function parseWorkbenchImport(json: string, factors: MigrationCaseFactors = MIGRATION_CASE_FACTORS): WorkbenchImportResult {
  const parsed: unknown = JSON.parse(json)
  if (isWorkbenchState(parsed)) return { state: parsed, legacyRaw: null }
  return { state: migrateLegacyScenario(parsed, factors), legacyRaw: parsed }
}

export function exportWorkbenchJson(state: WorkbenchState): string {
  return JSON.stringify(state, null, 2)
}
