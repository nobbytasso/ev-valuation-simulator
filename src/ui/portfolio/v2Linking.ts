/**
 * V2会社(Investment Case Workbench)とポートフォリオ銘柄の連動(純粋関数)。
 * 出典: docs/v2-adoption-spec.md §6.1(裁定B)、R-V2-1(時価定義)。
 *
 * V2連動銘柄の時価 = 採用ケース(`WorkbenchState.adoptedCaseId`)の
 * `currentAllowablePostMoney` × `holding.ownershipPct`(単一値。3点レンジなし)。
 * 採用ケース未選択・会社削除済みは呼び出し側でコスト評価にフォールバックする(P5-1と同じ規約)。
 */
import { getSectorDefinition } from '../../v2/domain/sectorDefinitions.ts'
import type { WorkbenchCollection, WorkbenchState } from '../../v2/domain/types.ts'
import type { Money } from '../../engine/index.ts'

export interface V2LinkedValuation {
  companyId: string
  companyName: string
  /** 採用ケースの現在許容Post-money(百万円)。R-V2-1。 */
  currentAllowablePostMoney: Money
}

/** 会社セレクタ用の選択肢(名前順)。 */
export function listV2CompanyOptions(collection: WorkbenchCollection): { id: string; name: string }[] {
  return Object.values(collection.workbenches)
    .map((state) => ({ id: state.company.id, name: state.company.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
}

/**
 * 1社分の採用ケース評価を解決する。会社が存在しない・採用ケース未選択・
 * 採用ケースが削除済みのいずれかのときは null(呼び出し側でコスト評価フォールバック)。
 */
export function resolveV2CompanyValuation(state: WorkbenchState | undefined): V2LinkedValuation | null {
  if (!state || !state.adoptedCaseId) return null
  const adoptedCase = state.cases.find((item) => item.id === state.adoptedCaseId)
  if (!adoptedCase) return null
  const definition = getSectorDefinition(state.company.sector)
  const result = definition.evaluate(state.company, adoptedCase)
  return {
    companyId: state.company.id,
    companyName: state.company.name,
    currentAllowablePostMoney: result.currentAllowablePostMoney,
  }
}

/** コレクション全体から companyId → 評価結果(または null)のマップを作る。 */
export function buildV2ValuationMap(collection: WorkbenchCollection): Map<string, V2LinkedValuation | null> {
  const map = new Map<string, V2LinkedValuation | null>()
  for (const state of Object.values(collection.workbenches)) {
    map.set(state.company.id, resolveV2CompanyValuation(state))
  }
  return map
}
