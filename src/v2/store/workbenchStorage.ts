import type { V2SectorId, WorkbenchCollection, WorkbenchState } from '../domain/types.ts'
import { createDefaultWorkbench } from '../domain/sectorDefinitions.ts'
import { MIGRATION_CASE_FACTORS, migrateLegacyScenario } from './legacyMigration.ts'
import type { MigrationCaseFactors } from './legacyMigration.ts'

export const WORKBENCH_STORAGE_KEY = 'ev-valuation-simulator:workbench:v2'

function isWorkbenchStateShape(value: unknown): value is WorkbenchState {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return record.schemaVersion === 2 && typeof record.company === 'object' && Array.isArray(record.cases)
}

/**
 * 欠落フィールドの補完(冪等)。`WorkbenchState` に永続化される型を拡張するたびに、ここへ
 * 補完ステップを追加する(CLAUDE.md 設計原則6: 型拡張には必ずマイグレーションを同伴)。
 * - adoptedCaseId: 欠落時 null 補完(docs/v2-adoption-spec.md §6.1)
 */
export function normalizeWorkbenchState(raw: WorkbenchState): WorkbenchState {
  return {
    ...raw,
    adoptedCaseId: raw.adoptedCaseId ?? null,
  }
}

function isWorkbenchState(value: unknown): value is WorkbenchState {
  return isWorkbenchStateShape(value)
}

function isCollectionShape(value: unknown): value is { activeCompanyId: unknown; workbenches: unknown } {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return 'activeCompanyId' in record && typeof record.workbenches === 'object' && record.workbenches !== null
}

function createDefaultCollection(): WorkbenchCollection {
  const state = createDefaultWorkbench()
  return { activeCompanyId: state.company.id, workbenches: { [state.company.id]: state } }
}

/**
 * 旧単一WorkbenchState形式(このタスク以前の永続化データ)を1社のコレクションとして包む
 * (後方互換ロード、docs/v2-adoption-spec.md §6.1「後方互換」要件、冪等)。
 */
function wrapSingleAsCollection(state: WorkbenchState): WorkbenchCollection {
  const normalized = normalizeWorkbenchState(state)
  return { activeCompanyId: normalized.company.id, workbenches: { [normalized.company.id]: normalized } }
}

function normalizeCollection(parsed: { activeCompanyId: unknown; workbenches: unknown }): WorkbenchCollection {
  const rawWorkbenches = parsed.workbenches as Record<string, unknown>
  const entries = Object.entries(rawWorkbenches)
    .filter((entry): entry is [string, WorkbenchState] => isWorkbenchState(entry[1]))
    .map(([id, state]) => [id, normalizeWorkbenchState(state)] as const)
  if (entries.length === 0) return createDefaultCollection()
  const workbenches = Object.fromEntries(entries)
  const activeCompanyId =
    typeof parsed.activeCompanyId === 'string' && workbenches[parsed.activeCompanyId]
      ? parsed.activeCompanyId
      : entries[0][0]
  return { activeCompanyId, workbenches }
}

/** localStorageから会社コレクションを読み込む。旧単一形式・破損データは後方互換/既定値へフォールバック。 */
export function loadWorkbenchCollection(): WorkbenchCollection {
  try {
    const saved = localStorage.getItem(WORKBENCH_STORAGE_KEY)
    if (!saved) return createDefaultCollection()
    const parsed: unknown = JSON.parse(saved)
    if (isWorkbenchState(parsed)) return wrapSingleAsCollection(parsed)
    if (isCollectionShape(parsed)) return normalizeCollection(parsed)
    return createDefaultCollection()
  } catch {
    return createDefaultCollection()
  }
}

export function saveWorkbenchCollection(collection: WorkbenchCollection): void {
  localStorage.setItem(WORKBENCH_STORAGE_KEY, JSON.stringify(collection))
}

/** アクティブ会社の`updatedAt`を更新して差し替える(会社1社分の状態更新に使う)。 */
export function withActiveWorkbenchUpdated(
  collection: WorkbenchCollection,
  updater: (state: WorkbenchState) => WorkbenchState,
): WorkbenchCollection {
  const current = collection.workbenches[collection.activeCompanyId]
  if (!current) return collection
  const next = { ...updater(current), updatedAt: new Date().toISOString() }
  return { ...collection, workbenches: { ...collection.workbenches, [next.company.id]: next } }
}

/** 会社を追加し、新規会社をアクティブにする。 */
export function addCompanyToCollection(
  collection: WorkbenchCollection,
  sector: V2SectorId = 'saas_jp',
  name = '新規会社',
): WorkbenchCollection {
  const state = createDefaultWorkbench(sector, name)
  return {
    activeCompanyId: state.company.id,
    workbenches: { ...collection.workbenches, [state.company.id]: state },
  }
}

/** 会社を複製する。ケースIDが変わるため`adoptedCaseId`は引き継がずnullにリセットする(複製直後は未選択)。 */
export function duplicateCompanyInCollection(
  collection: WorkbenchCollection,
  companyId: string,
): WorkbenchCollection {
  const source = collection.workbenches[companyId]
  if (!source) return collection
  const cloned: WorkbenchState = structuredClone(source)
  const newCompanyId = crypto.randomUUID()
  cloned.company = { ...cloned.company, id: newCompanyId, name: `${cloned.company.name}のコピー` }
  cloned.cases = cloned.cases.map((item) => ({ ...item, id: crypto.randomUUID() }))
  cloned.adoptedCaseId = null
  cloned.updatedAt = new Date().toISOString()
  return {
    activeCompanyId: newCompanyId,
    workbenches: { ...collection.workbenches, [newCompanyId]: cloned },
  }
}

/** 会社を削除する。最後の1社は削除できず既定値へ置き換える(会社コレクションは常に1社以上を保つ)。 */
export function removeCompanyFromCollection(
  collection: WorkbenchCollection,
  companyId: string,
): WorkbenchCollection {
  const remainingIds = Object.keys(collection.workbenches).filter((id) => id !== companyId)
  if (remainingIds.length === 0) return createDefaultCollection()
  const workbenches = Object.fromEntries(
    Object.entries(collection.workbenches).filter(([id]) => id !== companyId),
  )
  const activeCompanyId = collection.activeCompanyId === companyId ? remainingIds[0] : collection.activeCompanyId
  return { activeCompanyId, workbenches }
}

export function importWorkbenchJson(json: string): WorkbenchState {
  const parsed: unknown = JSON.parse(json)
  if (isWorkbenchState(parsed)) return normalizeWorkbenchState(parsed)
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
  if (isWorkbenchState(parsed)) return { state: normalizeWorkbenchState(parsed), legacyRaw: null }
  return { state: migrateLegacyScenario(parsed, factors), legacyRaw: parsed }
}

export function exportWorkbenchJson(state: WorkbenchState): string {
  return JSON.stringify(state, null, 2)
}
