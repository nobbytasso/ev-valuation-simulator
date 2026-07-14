import { describe, expect, it } from 'vitest'
import legacyPortfolioV1 from './fixtures/legacy-portfolio-v1.json'
import { migratePortfolioHolding } from './portfolioMigration.ts'
import { PORTFOLIO_SCHEMA_VERSION } from './scenarioTypes.ts'

describe('migratePortfolioHolding', () => {
  it('schemaVersion未設定(Phase2形式、v1)のデータをv2に移行しinvestmentDateをnull補完する(P5-3裁定)', () => {
    // fixture自体がv1形式(investmentDate/schemaVersionなし)であること(回帰対象)を確認
    expect(legacyPortfolioV1).not.toHaveProperty('schemaVersion')
    expect(legacyPortfolioV1).not.toHaveProperty('investmentDate')

    const migrated = migratePortfolioHolding(legacyPortfolioV1)

    expect(migrated.schemaVersion).toBe(PORTFOLIO_SCHEMA_VERSION)
    expect(migrated.investmentDate).toBeNull()
    // createdAtを投資日と偽装しない(P5-3裁定)
    expect(migrated.investmentDate).not.toBe(migrated.createdAt)
    expect(migrated.id).toBe('legacy-holding-0001')
    expect(migrated.companyName).toBe('レガシー株式会社')
    expect(migrated.investmentAmount).toBe(300)
  })

  it('既にv2(investmentDateあり)のデータは冪等(値を上書きしない)', () => {
    const current = { ...legacyPortfolioV1, schemaVersion: PORTFOLIO_SCHEMA_VERSION, investmentDate: '2026-01-15' }
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

  it('オブジェクトでない入力は例外を投げる', () => {
    expect(() => migratePortfolioHolding(null)).toThrow()
    expect(() => migratePortfolioHolding('x')).toThrow()
  })
})
