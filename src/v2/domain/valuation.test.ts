import { describe, expect, it } from 'vitest'
import type { CompanyProfile, InvestmentCase } from './types.ts'
import { buildCaseResult, projectMetric } from './valuation.ts'

const company: CompanyProfile = {
  id: 'company',
  name: 'Test',
  sector: 'saas_jp',
  valuationDate: '2026-07-17',
  fullyDilutedShares: 10,
  proposedPreMoney: 3000,
  currentNetDebt: 0,
  facts: {},
}

const investmentCase: InvestmentCase = {
  id: 'case',
  name: 'Base',
  narrative: '',
  exitRoute: 'ipo',
  yearsToExit: 5,
  targetMoic: 10,
  investmentAmount: 300,
  dilutionRetention: 0.7,
  exitNetDebt: 0,
  assumptions: {},
  followOns: [],
}

describe('projectMetric', () => {
  it('projects a decaying growth series to the exit year', () => {
    const result = projectMetric(100, 0.2, 0.5, 2)
    expect(result.value).toBeCloseTo(132)
    expect(result.finalGrowth).toBeCloseTo(0.1)
  })
})

describe('buildCaseResult', () => {
  it('bridges exit EV to current pre-money and share price', () => {
    const result = buildCaseResult(company, investmentCase, {
      exitMetricLabel: 'Exit ARR',
      exitMetric: 1000,
      exitEnterpriseValue: 10000,
    })
    expect(result.exitEquityValue).toBe(10000)
    expect(result.currentAllowablePostMoney).toBe(1000)
    expect(result.currentAllowablePreMoney).toBe(700)
    expect(result.theoreticalSharePrice).toBe(70)
    expect(result.requiredEntryOwnership).toBeCloseTo(0.3)
  })

  it('computes expected return from the proposed entry valuation', () => {
    const result = buildCaseResult(company, investmentCase, {
      exitMetricLabel: 'Exit ARR',
      exitMetric: 1000,
      exitEnterpriseValue: 10000,
    })
    expect(result.expectedEntryOwnership).toBeCloseTo(300 / 3300)
    expect(result.expectedExitOwnership).toBeCloseTo((300 / 3300) * 0.7)
    expect(result.expectedMoic).not.toBeNull()
  })
})
