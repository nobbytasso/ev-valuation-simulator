/**
 * ポートフォリオ永続化データのマイグレーションパイプライン。
 * 出典: docs/requirements-rev5.md §8
 *
 * PortfolioHolding は現時点で形式変更がないため MIGRATIONS は空だが、
 * schemaVersion 未設定の旧データ(Phase 2形式)を安全に読み込めるよう
 * scenarioMigration.ts と同じパイプライン構造を用意しておく。
 * 将来の形式変更時は MIGRATIONS に手順を追記する。
 */
import { PORTFOLIO_SCHEMA_VERSION } from './scenarioTypes.ts'
import type { PortfolioHolding } from './scenarioTypes.ts'

type RawRecord = Record<string, unknown>

function isRawRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null
}

const MIGRATIONS: Record<number, (raw: RawRecord) => RawRecord> = {}

export function migratePortfolioHolding(raw: unknown): PortfolioHolding {
  if (!isRawRecord(raw)) {
    throw new Error('migratePortfolioHolding: invalid data (not an object)')
  }
  let obj = raw
  let version = typeof obj.schemaVersion === 'number' ? obj.schemaVersion : 1
  while (version < PORTFOLIO_SCHEMA_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) break
    obj = step(obj)
    version += 1
  }
  return { ...obj, schemaVersion: PORTFOLIO_SCHEMA_VERSION } as PortfolioHolding
}
