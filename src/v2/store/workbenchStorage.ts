import type { WorkbenchState } from '../domain/types.ts'
import { createDefaultWorkbench } from '../domain/sectorDefinitions.ts'
import { migrateLegacyScenario } from './legacyMigration.ts'

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

export function exportWorkbenchJson(state: WorkbenchState): string {
  return JSON.stringify(state, null, 2)
}
