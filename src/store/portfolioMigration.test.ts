import { describe, expect, it } from 'vitest'
import legacyPortfolioV1 from './fixtures/legacy-portfolio-v1.json'
import legacyPortfolioV2 from './fixtures/legacy-portfolio-v2.json'
import { migratePortfolioHolding } from './portfolioMigration.ts'
import { PORTFOLIO_SCHEMA_VERSION } from './scenarioTypes.ts'

describe('migratePortfolioHolding', () => {
  it('schemaVersion未設定(Phase2形式、v1)のデータをv3に移行しinvestmentDate/v2CompanyIdをnull補完する(P5-3裁定・D-1)', () => {
    // fixture自体がv1形式(investmentDate/schemaVersionなし)であること(回帰対象)を確認
    expect(legacyPortfolioV1).not.toHaveProperty('schemaVersion')
    expect(legacyPortfolioV1).not.toHaveProperty('investmentDate')

    const migrated = migratePortfolioHolding(legacyPortfolioV1)

    expect(migrated.schemaVersion).toBe(PORTFOLIO_SCHEMA_VERSION)
    expect(migrated.investmentDate).toBeNull()
    expect(migrated.v2CompanyId).toBeNull()
    // createdAtを投資日と偽装しない(P5-3裁定)
    expect(migrated.investmentDate).not.toBe(migrated.createdAt)
    expect(migrated.id).toBe('legacy-holding-0001')
    expect(migrated.companyName).toBe('レガシー株式会社')
    expect(migrated.investmentAmount).toBe(300)
  })

  it('schemaVersion=2(v2CompanyIdなし)のデータをv3に移行しv2CompanyIdをnull補完する(D-1裁定)', () => {
    // fixture自体がv2形式(v2CompanyIdなし、schemaVersion=2)であること(回帰対象)を確認
    expect(legacyPortfolioV2).toHaveProperty('schemaVersion', 2)
    expect(legacyPortfolioV2).not.toHaveProperty('v2CompanyId')

    const migrated = migratePortfolioHolding(legacyPortfolioV2)

    expect(migrated.schemaVersion).toBe(PORTFOLIO_SCHEMA_VERSION)
    expect(migrated.v2CompanyId).toBeNull()
    // 既存のv2フィールド(investmentDate)は変更されない
    expect(migrated.investmentDate).toBe('2026-02-01')
    expect(migrated.companyName).toBe('V2移行前株式会社')
  })

  it('既に最新版(investmentDate・v2CompanyIdあり)のデータは冪等(値を上書きしない)', () => {
    const current = {
      ...legacyPortfolioV1,
      schemaVersion: PORTFOLIO_SCHEMA_VERSION,
      investmentDate: '2026-01-15',
      v2CompanyId: null,
    }
    const migrated = migratePortfolioHolding(current)
    expect(migrated).toEqual(current)

    // 再度通しても無変化(冪等性)
    const migratedAgain = migratePortfolioHolding(migrated)
    expect(migratedAgain).toEqual(migrated)
  })

  it('v2だがinvestmentDateが明示的にnullのデータは上書きしない(既に未設定として確定済み)', () => {
    const current = { ...legacyPortfolioV1, schemaVersion: PORTFOLIO_SCHEMA_VERSION, investmentDate: null }
    const migrated = migratePortfolioHolding(current)
    expect(migrated.investmentDate).toBeNull()
  })

  it('既にv3(v2CompanyIdが値あり)のデータは冪等(値を上書きしない)', () => {
    const current = {
      ...legacyPortfolioV1,
      schemaVersion: PORTFOLIO_SCHEMA_VERSION,
      investmentDate: '2026-01-15',
      v2CompanyId: 'company-abc',
    }
    const migrated = migratePortfolioHolding(current)
    expect(migrated).toEqual(current)
    const migratedAgain = migratePortfolioHolding(migrated)
    expect(migratedAgain).toEqual(migrated)
  })

  it('オブジェクトでない入力は例外を投げる', () => {
    expect(() => migratePortfolioHolding(null)).toThrow()
    expect(() => migratePortfolioHolding('x')).toThrow()
  })
})
