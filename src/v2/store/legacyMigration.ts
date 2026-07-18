import type { V2SectorId, WorkbenchState } from '../domain/types.ts'
import { createDefaultWorkbench } from '../domain/sectorDefinitions.ts'

type RawRecord = Record<string, unknown>

function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null
}

function numberAt(record: RawRecord, key: string, fallback: number): number {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function rangeAt(record: RawRecord, key: string): RawRecord {
  const value = record[key]
  return isRecord(value) ? value : {}
}

// 4ケース(会社計画/引受ケース/Downside/Severe Downside)分の近似展開係数。
export type CaseFactorTuple = [number, number, number, number]

export interface SaasMigrationFactors {
  /** arrGrowth に乗じる、ケース毎の倍率(主要係数)。 */
  growthFactor: CaseFactorTuple
  /** Severe Downside の exitMultiple = pessimistic × この係数。 */
  severeMultipleFactor: number
}

export interface EcMigrationFactors {
  growthFactor: CaseFactorTuple
  severeMultipleFactor: number
}

export interface MediaMigrationFactors {
  growthFactor: CaseFactorTuple
  severeMultipleFactor: number
}

export interface MedicalDeviceMigrationFactors {
  growthFactor: CaseFactorTuple
  approvalDelayOffset: CaseFactorTuple
  penetrationFactor: CaseFactorTuple
  yearsToPeakOffset: CaseFactorTuple
  marginFactor: CaseFactorTuple
  /** Severe Downside の discountRate = pessimistic + この加算値(上限0.3)。 */
  severeDiscountRateOffset: number
}

export interface DrugDiscoveryMigrationFactors {
  /** posAtExit に乗じる、ケース毎の倍率(主要係数)。 */
  posFactor: CaseFactorTuple
  /** peakSalesGrowth の絶対値(旧ScenarioにExit時点の値が存在しないため固定値で近似)。 */
  peakSalesGrowthAbsolute: CaseFactorTuple
}

export interface ClimateMigrationFactors {
  probabilityFactor: CaseFactorTuple
  merchantRealizationFactor: CaseFactorTuple
  costDeclineFactor: CaseFactorTuple
  carbonPriceFactor: CaseFactorTuple
}

export interface MigrationCaseFactors {
  saas_jp: SaasMigrationFactors
  ec_d2c: EcMigrationFactors
  media_tech: MediaMigrationFactors
  medical_device: MedicalDeviceMigrationFactors
  drug_discovery: DrugDiscoveryMigrationFactors
  climate_tech: ClimateMigrationFactors
}

/**
 * 旧Scenarioの悲観/ベース/楽観 3点レンジを、V2の4つの独立ケースへ近似展開するための既定係数。
 * `docs/v2-adoption-spec.md` §3(裁定③)によりインポートUIで編集可能とする(既定=本テーブル)。
 * 係数自体は保存対象ではなく移行時の一時値。
 */
export const MIGRATION_CASE_FACTORS: MigrationCaseFactors = {
  saas_jp: {
    growthFactor: [1.2, 1, 0.55, 0.15],
    severeMultipleFactor: 0.65,
  },
  ec_d2c: {
    growthFactor: [1.2, 1, 0.5, -0.2],
    severeMultipleFactor: 0.65,
  },
  media_tech: {
    growthFactor: [1.2, 1, 0.45, -0.25],
    severeMultipleFactor: 0.65,
  },
  medical_device: {
    growthFactor: [1.2, 1, 0.6, 0.2],
    approvalDelayOffset: [0, 1, 2, 4],
    penetrationFactor: [1.2, 1, 0.65, 0.3],
    yearsToPeakOffset: [0, 0, 1, 2],
    marginFactor: [1.25, 1, 0.65, 0.3],
    severeDiscountRateOffset: 0.03,
  },
  drug_discovery: {
    posFactor: [2.2, 1.5, 0.7, 0.15],
    peakSalesGrowthAbsolute: [0.08, 0.03, -0.05, -0.1],
  },
  climate_tech: {
    probabilityFactor: [1.25, 1, 0.55, 0.25],
    merchantRealizationFactor: [1, 0.9, 0.7, 0.5],
    costDeclineFactor: [1.3, 1, 0.65, 0.3],
    carbonPriceFactor: [1.4, 1, 0.6, 0.3],
  },
}

function migrateSaas(state: WorkbenchState, inputs: RawRecord, factors: SaasMigrationFactors): void {
  state.company.facts.currentArr = numberAt(inputs, 'arr', 1000)
  const multiple = rangeAt(inputs, 'evArrMultiple')
  const growth = numberAt(inputs, 'arrGrowth', 0.2)
  state.cases.forEach((item, index) => {
    item.assumptions.arrGrowth = Math.max(-0.5, growth * factors.growthFactor[index])
    item.assumptions.exitMultiple = [
      numberAt(multiple, 'optimistic', 10),
      numberAt(multiple, 'base', 7),
      numberAt(multiple, 'pessimistic', 4),
      Math.max(0.5, numberAt(multiple, 'pessimistic', 4) * factors.severeMultipleFactor),
    ][index]
  })
}

function migrateEc(state: WorkbenchState, inputs: RawRecord, factors: EcMigrationFactors): void {
  state.company.facts.currentRevenue = numberAt(inputs, 'annualRevenue', 2000)
  state.company.facts.currentGrossMargin = numberAt(inputs, 'grossMargin', 0.45)
  const multiple = rangeAt(inputs, 'evMultiple')
  const growth = numberAt(inputs, 'revenueGrowth', 0.2)
  state.cases.forEach((item, index) => {
    item.assumptions.revenueGrowth = Math.max(-0.5, growth * factors.growthFactor[index])
    item.assumptions.exitGrossMargin = numberAt(inputs, 'grossMargin', 0.45)
    item.assumptions.multipleBasis = inputs.multipleBasis === 'grossProfit' ? 'grossProfit' : 'revenue'
    item.assumptions.exitMultiple = [
      numberAt(multiple, 'optimistic', 3.5),
      numberAt(multiple, 'base', 2.2),
      numberAt(multiple, 'pessimistic', 1.2),
      Math.max(0.5, numberAt(multiple, 'pessimistic', 1.2) * factors.severeMultipleFactor),
    ][index]
  })
}

function migrateMedia(state: WorkbenchState, inputs: RawRecord, factors: MediaMigrationFactors): void {
  state.company.facts.currentMau = numberAt(inputs, 'mau', 2_000_000)
  const arpu = isRecord(inputs.arpuMonthly) ? inputs.arpuMonthly : {}
  state.company.facts.currentMonthlyArpu =
    numberAt(arpu, 'ad', 100) + numberAt(arpu, 'paid', 50) + numberAt(arpu, 'commerce', 20)
  const multiple = rangeAt(inputs, 'evSalesMultiple')
  const growth = numberAt(inputs, 'mauGrowth', 0.2)
  state.cases.forEach((item, index) => {
    item.assumptions.mauGrowth = Math.max(-0.5, growth * factors.growthFactor[index])
    item.assumptions.exitMultiple = [
      numberAt(multiple, 'optimistic', 6),
      numberAt(multiple, 'base', 4),
      numberAt(multiple, 'pessimistic', 2),
      Math.max(0.5, numberAt(multiple, 'pessimistic', 2) * factors.severeMultipleFactor),
    ][index]
  })
}

function migrateMedicalDevice(
  state: WorkbenchState,
  inputs: RawRecord,
  factors: MedicalDeviceMigrationFactors,
): void {
  state.company.facts.annualProcedures = numberAt(inputs, 'annualProcedures', 15000)
  state.company.facts.pricePerProcedure = numberAt(inputs, 'pricePerProcedure', 150000)
  state.company.facts.launchYear = numberAt(inputs, 'launchYear', 2)
  state.company.facts.recurringRatio = numberAt(inputs, 'recurringRatio', 0.2)
  const discount = rangeAt(inputs, 'discountRate')
  const baseDelay = numberAt(inputs, 'approvalDelayYears', 0)
  state.cases.forEach((item, index) => {
    item.assumptions.procedureGrowth = numberAt(inputs, 'procedureGrowth', 0.05) * factors.growthFactor[index]
    item.assumptions.approvalDelayYears = baseDelay + factors.approvalDelayOffset[index]
    item.assumptions.peakPenetration = Math.max(
      0,
      numberAt(inputs, 'peakPenetration', 0.3) * factors.penetrationFactor[index],
    )
    item.assumptions.yearsToPeak = numberAt(inputs, 'yearsToPeak', 4) + factors.yearsToPeakOffset[index]
    item.assumptions.operatingMargin = numberAt(inputs, 'operatingMargin', 0.15) * factors.marginFactor[index]
    item.assumptions.discountRate = [
      numberAt(discount, 'optimistic', 0.1),
      numberAt(discount, 'base', 0.12),
      numberAt(discount, 'pessimistic', 0.14),
      Math.min(0.3, numberAt(discount, 'pessimistic', 0.14) + factors.severeDiscountRateOffset),
    ][index]
    item.assumptions.terminalGrowth = numberAt(inputs, 'terminalGrowth', 0.02)
  })
}

const PHASE_ORDER = ['preclinical', 'phase1', 'phase2', 'phase3', 'filing'] as const

function assetPos(asset: RawRecord): number {
  const phase = typeof asset.currentPhase === 'string' ? asset.currentPhase : 'preclinical'
  const start = Math.max(0, PHASE_ORDER.indexOf(phase as (typeof PHASE_ORDER)[number]))
  const probs = isRecord(asset.phaseSuccessProbs) ? asset.phaseSuccessProbs : {}
  return PHASE_ORDER.slice(start).reduce((product, item) => product * numberAt(probs, item, 1), 1)
}

function migrateDrugDiscovery(
  state: WorkbenchState,
  inputs: RawRecord,
  factors: DrugDiscoveryMigrationFactors,
): void {
  const assets = Array.isArray(inputs.assets) ? inputs.assets.filter(isRecord) : []
  const peakSales = assets.reduce((sum, asset) => sum + numberAt(asset, 'peakSales', 0), 0)
  const weightedPosNumerator = assets.reduce(
    (sum, asset) => sum + numberAt(asset, 'peakSales', 0) * assetPos(asset),
    0,
  )
  const weightedPos = peakSales > 0 ? weightedPosNumerator / peakSales : 0.3
  state.company.facts.currentPeakSales = peakSales || 5000
  state.company.facts.currentRnpv = 0
  state.cases.forEach((item, index) => {
    item.assumptions.posAtExit = Math.min(1, Math.max(0, weightedPos * factors.posFactor[index]))
    item.assumptions.peakSalesGrowth = factors.peakSalesGrowthAbsolute[index]
  })
  state.notices.push('旧創薬ScenarioからCurrent rNPVは再現できないため、0で移行しています。案件のrNPVを入力してください。')
}

function migrateClimateTech(state: WorkbenchState, inputs: RawRecord, factors: ClimateMigrationFactors): void {
  state.company.facts.currentProjectNpv = 0
  state.company.facts.annualCapacity = numberAt(inputs, 'annualCapacityUnits', 450000)
  state.company.facts.unitPrice = numberAt(inputs, 'unitPrice', 8000)
  state.company.facts.unitCost = numberAt(inputs, 'unitCost0', 9000)
  state.company.facts.fixedOpex = numberAt(inputs, 'fixedOpexAnnual', 500)
  state.company.facts.carbonCreditVolume = numberAt(inputs, 'carbonCreditVolume', 100000)
  state.cases.forEach((item, index) => {
    const factor = factors.probabilityFactor[index]
    item.assumptions.massProductionProbability = Math.min(1, numberAt(inputs, 'massProductionProb', 0.6) * factor)
    item.assumptions.offtakeCoverage = Math.min(1, numberAt(inputs, 'offtakeCoverage', 0.4) * factor)
    item.assumptions.merchantRealization =
      numberAt(inputs, 'merchantRealization', 1) * factors.merchantRealizationFactor[index]
    item.assumptions.costDeclineRate = numberAt(inputs, 'costDeclineRate', 0.08) * factors.costDeclineFactor[index]
    item.assumptions.carbonCreditPrice = numberAt(inputs, 'carbonCreditPrice', 5000) * factors.carbonPriceFactor[index]
  })
  state.notices.push('旧Climate ScenarioからCurrent Project NPVは再現せず、0で移行しています。案件のProject NPVを入力してください。')
}

export function migrateLegacyScenario(raw: unknown, factors: MigrationCaseFactors = MIGRATION_CASE_FACTORS): WorkbenchState {
  if (!isRecord(raw) || typeof raw.sector !== 'string' || !isRecord(raw.inputs)) {
    throw new Error('旧Scenario形式として解釈できません。')
  }
  const sector = raw.sector as V2SectorId
  const supported: V2SectorId[] = [
    'saas_jp',
    'drug_discovery',
    'medical_device',
    'media_tech',
    'ec_d2c',
    'climate_tech',
  ]
  if (!supported.includes(sector)) throw new Error(`未対応セクター: ${sector}`)

  const state = createDefaultWorkbench(sector, typeof raw.name === 'string' ? raw.name : '移行シナリオ')
  const inputs = raw.inputs

  if (sector === 'saas_jp') migrateSaas(state, inputs, factors.saas_jp)
  if (sector === 'ec_d2c') migrateEc(state, inputs, factors.ec_d2c)
  if (sector === 'media_tech') migrateMedia(state, inputs, factors.media_tech)
  if (sector === 'medical_device') migrateMedicalDevice(state, inputs, factors.medical_device)
  if (sector === 'drug_discovery') migrateDrugDiscovery(state, inputs, factors.drug_discovery)
  if (sector === 'climate_tech') migrateClimateTech(state, inputs, factors.climate_tech)

  if (isRecord(raw.vcMethod)) {
    const vc = raw.vcMethod
    state.cases.forEach((item) => {
      item.targetMoic = numberAt(vc, 'targetMultiple', item.targetMoic)
      item.yearsToExit = numberAt(vc, 'yearsToExit', item.yearsToExit)
      item.investmentAmount = numberAt(vc, 'investment', item.investmentAmount)
      item.dilutionRetention = numberAt(vc, 'dilutionRetention', item.dilutionRetention)
      item.exitNetDebt = numberAt(vc, 'netDebtAtExit', item.exitNetDebt)
    })
  }

  state.notices = [
    ...state.notices,
    '旧Scenario v3から自動移行しました。',
    '旧形式の悲観・ベース・楽観は、4つの独立ケースへ近似展開しています。',
    'プリセット適用済みの値が会社固有値かダミー値かは判別できないため、全入力を確認してください。',
  ]
  state.updatedAt = new Date().toISOString()
  return state
}
