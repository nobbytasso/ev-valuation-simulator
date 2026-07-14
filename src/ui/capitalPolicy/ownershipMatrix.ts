/**
 * ラウンド毎の持分推移マトリクスの構築(純粋関数)。出典: docs/phase4-spec.md §4.3-1
 * CapitalPolicySection(画面表示)・Excel単票の資本政策シート(C6)の両方から参照する
 * (計算ロジックを複製しない)。
 */
import type { CapTableHolder, RoundSnapshot } from '../../engine/index.ts'

export interface HolderRowValues {
  id: string
  name: string
  values: (number | null)[] // [初期, ラウンド1後, ラウンド2後, ...]
}

/** 途中参加の保有者は参加前の列を空欄(null)にする。 */
export function buildOwnershipMatrix(initialCapTable: CapTableHolder[], rounds: RoundSnapshot[]): HolderRowValues[] {
  const columns: CapTableHolder[][] = [initialCapTable, ...rounds.map((r) => r.capTableAfter)]
  const order: string[] = []
  const namesById = new Map<string, string>()
  for (const column of columns) {
    for (const holder of column) {
      if (!namesById.has(holder.id)) {
        namesById.set(holder.id, holder.name)
        order.push(holder.id)
      }
    }
  }
  return order.map((id) => ({
    id,
    name: namesById.get(id) as string,
    values: columns.map((column) => column.find((h) => h.id === id)?.ownership ?? null),
  }))
}
