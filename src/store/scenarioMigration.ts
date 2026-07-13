/**
 * シナリオ永続化データのマイグレーションパイプライン。
 * 出典: docs/requirements-rev5.md §8、docs/review-phase3.md D-1裁定、phase4-spec.md §4.1
 *
 * Phase 2で保存されたシナリオ(vcMethodフィールドなし、schemaVersionフィールドなし)は
 * v1として扱う。Phase 3でvcMethodを追加したv2、Phase 4でcapitalPolicyを追加したv3への
 * 移行手順をここに定義する。
 * ロード時(LocalStorageAdapter.list/load 内部の readAll)・インポート時
 * (LocalStorageAdapter.import)の両経路で同じ関数を通すことで、旧形式データでも
 * クラッシュしないことを保証する(LocalStorageAdapterへの注入は scenarioStore.ts)。
 *
 * 将来のスキーマ変更(v3→v4等)は MIGRATIONS に手順を追記するだけでよい。
 */
import { defaultCapitalPolicyInputs, defaultVcMethodInputs } from './defaultInputs.ts'
import { SCENARIO_SCHEMA_VERSION } from './scenarioTypes.ts'
import type { Scenario } from './scenarioTypes.ts'

type RawRecord = Record<string, unknown>

function isRawRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null
}

/** v1(Phase 2形式) → v2: vcMethod を既定値で補完する。 */
function migrateV1ToV2(raw: RawRecord): RawRecord {
  if (raw.vcMethod) return raw
  return { ...raw, vcMethod: defaultVcMethodInputs() }
}

/** v2 → v3: capitalPolicy を既定値で補完する(Phase 4、phase4-spec.md §4.1)。 */
function migrateV2ToV3(raw: RawRecord): RawRecord {
  if (raw.capitalPolicy) return raw
  return { ...raw, capitalPolicy: defaultCapitalPolicyInputs() }
}

/** キー: 移行前バージョン。値: そのバージョンから次バージョンへの変換手順。 */
const MIGRATIONS: Record<number, (raw: RawRecord) => RawRecord> = {
  1: migrateV1ToV2,
  2: migrateV2ToV3,
}

/**
 * 任意バージョンの永続化データを現行スキーマ(schemaVersion = SCENARIO_SCHEMA_VERSION)の
 * Scenario に変換する。schemaVersion 未設定は v1(Phase 2形式)とみなす。
 * 対応する移行手順が存在しないバージョンに達した場合は、それ以上変換せず
 * schemaVersion のみ現行値に更新して返す(致命的な形式破損でも例外を投げてクラッシュ
 * させない。呼び出し元の LocalStorageAdapter は個別アイテム単位でこの関数を呼ぶため、
 * 1件が旧形式のままでも全体のロードは継続できる)。
 */
export function migrateScenario(raw: unknown): Scenario {
  if (!isRawRecord(raw)) {
    throw new Error('migrateScenario: invalid data (not an object)')
  }
  let obj = raw
  let version = typeof obj.schemaVersion === 'number' ? obj.schemaVersion : 1
  while (version < SCENARIO_SCHEMA_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) break
    obj = step(obj)
    version += 1
  }
  return { ...obj, schemaVersion: SCENARIO_SCHEMA_VERSION } as Scenario
}
