import type { WorkbenchCaseResult } from '../../engine/workbench/types.ts'

export const V2_SECTOR_IDS = [
  'saas_jp',
  'drug_discovery',
  'medical_device',
  'media_tech',
  'ec_d2c',
  'climate_tech',
] as const

export type V2SectorId = (typeof V2_SECTOR_IDS)[number]
export type ValueBag = Record<string, number | string>

export interface CompanyProfile {
  id: string
  name: string
  sector: V2SectorId
  valuationDate: string
  fullyDilutedShares: number
  proposedPreMoney: number
  currentNetDebt: number
  facts: ValueBag
}

export type ExitRoute = 'ipo' | 'ma' | 'secondary' | 'milestone'

export interface InvestmentCase {
  id: string
  name: string
  narrative: string
  exitRoute: ExitRoute
  yearsToExit: number
  targetMoic: number
  investmentAmount: number
  dilutionRetention: number
  exitNetDebt: number
  assumptions: ValueBag
}

// Valuation Bridge の計算結果型は src/engine/workbench/ が単一の定義元(裁定①)。
export type CaseResult = WorkbenchCaseResult

export interface WorkbenchState {
  schemaVersion: 2
  company: CompanyProfile
  cases: InvestmentCase[]
  notices: string[]
  updatedAt: string
}

export type FieldFormat = 'number' | 'money' | 'percent' | 'multiple' | 'yen' | 'millionShares'

export interface SelectOption {
  value: string
  label: string
}

export interface FieldDefinition {
  id: string
  label: string
  description?: string
  kind?: 'number' | 'select'
  format?: FieldFormat
  step?: number
  min?: number
  max?: number
  options?: SelectOption[]
}

export interface SectorDefinition {
  id: V2SectorId
  label: string
  valuationMethod: string
  formulaSummary: string
  companyFields: FieldDefinition[]
  caseFields: FieldDefinition[]
  defaultCompanyFacts: ValueBag
  defaultCaseAssumptions: ValueBag[]
  evaluate: (company: CompanyProfile, investmentCase: InvestmentCase) => CaseResult
}
