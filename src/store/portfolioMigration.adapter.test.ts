// @vitest-environment jsdom
/**
 * D-1回帰テスト: v1形式(investmentDateなし)のポートフォリオデータが、ロード経路
 * (LocalStorageAdapter.list)・インポート経路(LocalStorageAdapter.import)の両方で
 * 同じmigratePortfolioHoldingを通り、v2(investmentDate: null補完)に移行されることを確認する。
 * 出典: CLAUDE.md 設計原則6、docs/phase5-spec.md §3.2(P5-3裁定)
 */
import { afterEach, describe, expect, it } from 'vitest'
import { LocalStorageAdapter } from '../adapters/storage/LocalStorageAdapter.ts'
import legacyPortfolioV1 from './fixtures/legacy-portfolio-v1.json'
import legacyPortfolioV2 from './fixtures/legacy-portfolio-v2.json'
import { migratePortfolioHolding } from './portfolioMigration.ts'
import { PORTFOLIO_SCHEMA_VERSION } from './scenarioTypes.ts'
import type { PortfolioHolding } from './scenarioTypes.ts'

const TEST_KEY = 'ev-valuation-simulator:portfolio:test-migration'

afterEach(() => {
  window.localStorage.clear()
})

describe('PortfolioHolding v1→v3移行(両経路)', () => {
  it('ロード経路(list): localStorageのv1生データがv3として読み込まれる', async () => {
    window.localStorage.setItem(TEST_KEY, JSON.stringify([legacyPortfolioV1]))
    const adapter = new LocalStorageAdapter<PortfolioHolding>(TEST_KEY, migratePortfolioHolding)

    const [loaded] = await adapter.list()

    expect(loaded.schemaVersion).toBe(PORTFOLIO_SCHEMA_VERSION)
    expect(loaded.investmentDate).toBeNull()
    expect(loaded.v2CompanyId).toBeNull()
    expect(loaded.companyName).toBe('レガシー株式会社')
  })

  it('インポート経路(import): v1形式のJSONをインポートするとv3として保存される', async () => {
    const adapter = new LocalStorageAdapter<PortfolioHolding>(TEST_KEY, migratePortfolioHolding)

    const imported = await adapter.import(JSON.stringify(legacyPortfolioV1))

    expect(imported.schemaVersion).toBe(PORTFOLIO_SCHEMA_VERSION)
    expect(imported.investmentDate).toBeNull()
    expect(imported.v2CompanyId).toBeNull()
    // インポートは新しいidを採番する(LocalStorageAdapter.importの既存契約)
    expect(imported.id).not.toBe(legacyPortfolioV1.id)

    const [persisted] = await adapter.list()
    expect(persisted.schemaVersion).toBe(PORTFOLIO_SCHEMA_VERSION)
    expect(persisted.investmentDate).toBeNull()
    expect(persisted.v2CompanyId).toBeNull()
  })
})

describe('PortfolioHolding v2→v3移行(両経路、D-1裁定)', () => {
  it('ロード経路(list): localStorageのv2生データ(v2CompanyIdなし)がv3として読み込まれる', async () => {
    window.localStorage.setItem(TEST_KEY, JSON.stringify([legacyPortfolioV2]))
    const adapter = new LocalStorageAdapter<PortfolioHolding>(TEST_KEY, migratePortfolioHolding)

    const [loaded] = await adapter.list()

    expect(loaded.schemaVersion).toBe(PORTFOLIO_SCHEMA_VERSION)
    expect(loaded.v2CompanyId).toBeNull()
    expect(loaded.investmentDate).toBe('2026-02-01')
    expect(loaded.companyName).toBe('V2移行前株式会社')
  })

  it('インポート経路(import): v2形式のJSONをインポートするとv3として保存される', async () => {
    const adapter = new LocalStorageAdapter<PortfolioHolding>(TEST_KEY, migratePortfolioHolding)

    const imported = await adapter.import(JSON.stringify(legacyPortfolioV2))

    expect(imported.schemaVersion).toBe(PORTFOLIO_SCHEMA_VERSION)
    expect(imported.v2CompanyId).toBeNull()

    const [persisted] = await adapter.list()
    expect(persisted.schemaVersion).toBe(PORTFOLIO_SCHEMA_VERSION)
    expect(persisted.v2CompanyId).toBeNull()
  })
})
