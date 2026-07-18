/**
 * ポートフォリオ永続化データのマイグレーションパイプライン。
 * 出典: docs/requirements-rev5.md §8、docs/phase5-spec.md §3.2(P5-3裁定)
 *
 * schemaVersion 未設定の旧データ(Phase 2形式)を安全に読み込めるよう
 * scenarioMigration.ts と同じパイプライン構造を用いる。
 * ロード時(LocalStorageAdapter.list/load 内部の readAll)・インポート時
 * (LocalStorageAdapter.import)の両経路で同じ関数を通す(D-1裁定と同じ規律。
 * portfolioStore.ts での注入により両経路とも本関数を通過する)。
 */
import { PORTFOLIO_SCHEMA_VERSION } from './scenarioTypes.ts'
import type { PortfolioHolding } from './scenarioTypes.ts'

type RawRecord = Record<string, unknown>

function isRawRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null
}

/**
 * v1(Phase 2形式) → v2: investmentDate を null で補完する。
 * P5-3裁定: createdAt を投資日と偽装しない(誤ったIRRを黙って出すより「未設定」を明示する)。
 */
function migrateV1ToV2(raw: RawRecord): RawRecord {
  if ('investmentDate' in raw) return raw
  return { ...raw, investmentDate: null }
}

/**
 * v2 → v3: v2CompanyId を null で補完する。
 * 出典: docs/v2-adoption-spec.md §6.1(V2企業とポートフォリオの連動、CLAUDE.md設計原則6)。
 */
function migrateV2ToV3(raw: RawRecord): RawRecord {
  if ('v2CompanyId' in raw) return raw
  return { ...raw, v2CompanyId: null }
}

/** キー: 移行前バージョン。値: そのバージョンから次バージョンへの変換手順。 */
const MIGRATIONS: Record<number, (raw: RawRecord) => RawRecord> = {
  1: migrateV1ToV2,
  2: migrateV2ToV3,
}

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
