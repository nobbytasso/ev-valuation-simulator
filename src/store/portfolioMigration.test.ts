import { describe, expect, it } from 'vitest'
import legacyPortfolioV1 from './fixtures/legacy-portfolio-v1.json'
import { migratePortfolioHolding } from './portfolioMigration.ts'
import { PORTFOLIO_SCHEMA_VERSION } from './scenarioTypes.ts'

describe('migratePortfolioHolding', () => {
  it('schemaVersion未設定(Phase2形式)のデータにschemaVersionを付与する', () => {
    expect(legacyPortfolioV1).not.toHaveProperty('schemaVersion')

    const migrated = migratePortfolioHolding(legacyPortfolioV1)

    expect(migrated.schemaVersion).toBe(PORTFOLIO_SCHEMA_VERSION)
    expect(migrated.id).toBe('legacy-holding-0001')
    expect(migrated.companyName).toBe('レガシー株式会社')
    expect(migrated.investmentAmount).toBe(300)
  })

  it('既にschemaVersionありのデータは冪等(値を上書きしない)', () => {
    const current = { ...legacyPortfolioV1, schemaVersion: PORTFOLIO_SCHEMA_VERSION }
    const migrated = migratePortfolioHolding(current)
    expect(migrated).toEqual(current)
  })

  it('オブジェクトでない入力は例外を投げる', () => {
    expect(() => migratePortfolioHolding(null)).toThrow()
    expect(() => migratePortfolioHolding('x')).toThrow()
  })
})
