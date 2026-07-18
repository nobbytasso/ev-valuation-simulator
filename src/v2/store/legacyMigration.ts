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

function migrateSaas(state: WorkbenchState, inputs: RawRecord): void {
  state.company.facts.currentArr = numberAt(inputs, 'arr', 1000)
  const multiple = rangeAt(inputs, 'evArrMultiple')
  const growth = numberAt(inputs, 'arrGrowth', 0.2)
  state.cases.forEach((item, index) => {
    item.assumptions.arrGrowth = Math.max(-0.5, growth * [1.2, 1, 0.55, 0.15][index])
    item.assumptions.exitMultiple = [
      numberAt(multiple, 'optimistic', 10),
      numberAt(multiple, 'base', 7),
      numberAt(multiple, 'pessimistic', 4),
      Math.max(0.5, numberAt(multiple, 'pessimistic', 4) * 0.65),
    ][index]
  })
}

function migrateEc(state: WorkbenchState, inputs: RawRecord): void {
  state.company.facts.currentRevenue = numberAt(inputs, 'annualRevenue', 2000)
  state.company.facts.currentGrossMargin = numberAt(inputs, 'grossMargin', 0.45)
  const multiple = rangeAt(inputs, 'evMultiple')
  const growth = numberAt(inputs, 'revenueGrowth', 0.2)
  state.cases.forEach((item, index) => {
    item.assumptions.revenueGrowth = Math.max(-0.5, growth * [1.2, 1, 0.5, -0.2][index])
    item.assumptions.exitGrossMargin = numberAt(inputs, 'grossMargin', 0.45)
    item.assumptions.multipleBasis = inputs.multipleBasis === 'grossProfit' ? 'grossProfit' : 'revenue'
    item.assumptions.exitMultiple = [
      numberAt(multiple, 'optimistic', 3.5),
      numberAt(multiple, 'base', 2.2),
      numberAt(multiple, 'pessimistic', 1.2),
      Math.max(0.5, numberAt(multiple, 'pessimistic', 1.2) * 0.65),
    ][index]
  })
}

function migrateMedia(state: WorkbenchState, inputs: RawRecord): void {
  state.company.facts.currentMau = numberAt(inputs, 'mau', 2_000_000)
  const arpu = isRecord(inputs.arpuMonthly) ? inputs.arpuMonthly : {}
  state.company.facts.currentMonthlyArpu =
    numberAt(arpu, 'ad', 100) + numberAt(arpu, 'paid', 50) + numberAt(arpu, 'commerce', 20)
  const multiple = rangeAt(inputs, 'evSalesMultiple')
  const growth = numberAt(inputs, 'mauGrowth', 0.2)
  state.cases.forEach((item, index) => {
    item.assumptions.mauGrowth = Math.max(-0.5, growth * [1.2, 1, 0.45, -0.25][index])
    item.assumptions.exitMultiple = [
      numberAt(multiple, 'optimistic', 6),
      numberAt(multiple, 'base', 4),
      numberAt(multiple, 'pessimistic', 2),
      Math.max(0.5, numberAt(multiple, 'pessimistic', 2) * 0.65),
    ][index]
  })
}


function migrateMedicalDevice(state: WorkbenchState, inputs: RawRecord): void {
  state.company.facts.annualProcedures = numberAt(inputs, 'annualProcedures', 15000)
  state.company.facts.pricePerProcedure = numberAt(inputs, 'pricePerProcedure', 150000)
  state.company.facts.launchYear = numberAt(inputs, 'launchYear', 2)
  state.company.facts.recurringRatio = numberAt(inputs, 'recurringRatio', 0.2)
  const discount = rangeAt(inputs, 'discountRate')
  const baseDelay = numberAt(inputs, 'approvalDelayYears', 0)
  state.cases.forEach((item, index) => {
    item.assumptions.procedureGrowth = numberAt(inputs, 'procedureGrowth', 0.05) * [1.2, 1, 0.6, 0.2][index]
    item.assumptions.approvalDelayYears = baseDelay + [0, 1, 2, 4][index]
    item.assumptions.peakPenetration = Math.max(0, numberAt(inputs, 'peakPenetration', 0.3) * [1.2, 1, 0.65, 0.3][index])
    item.assumptions.yearsToPeak = numberAt(inputs, 'yearsToPeak', 4) + [0, 0, 1, 2][index]
    item.assumptions.operatingMargin = numberAt(inputs, 'operatingMargin', 0.15) * [1.25, 1, 0.65, 0.3][index]
    item.assumptions.discountRate = [
      numberAt(discount, 'optimistic', 0.1),
      numberAt(discount, 'base', 0.12),
      numberAt(discount, 'pessimistic', 0.14),
      Math.min(0.3, numberAt(discount, 'pessimistic', 0.14) + 0.03),
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

function migrateDrugDiscovery(state: WorkbenchState, inputs: RawRecord): void {
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
    item.assumptions.posAtExit = Math.min(1, Math.max(0, weightedPos * [2.2, 1.5, 0.7, 0.15][index]))
    item.assumptions.peakSalesGrowth = [0.08, 0.03, -0.05, -0.1][index]
  })
  state.notices.push('旧創薬ScenarioからCurrent rNPVは再現できないため、0で移行しています。案件のrNPVを入力してください。')
}

function migrateClimateTech(state: WorkbenchState, inputs: RawRecord): void {
  state.company.facts.currentProjectNpv = 0
  state.company.facts.annualCapacity = numberAt(inputs, 'annualCapacityUnits', 450000)
  state.company.facts.unitPrice = numberAt(inputs, 'unitPrice', 8000)
  state.company.facts.unitCost = numberAt(inputs, 'unitCost0', 9000)
  state.company.facts.fixedOpex = numberAt(inputs, 'fixedOpexAnnual', 500)
  state.company.facts.carbonCreditVolume = numberAt(inputs, 'carbonCreditVolume', 100000)
  state.cases.forEach((item, index) => {
    const factor = [1.25, 1, 0.55, 0.25][index]
    item.assumptions.massProductionProbability = Math.min(1, numberAt(inputs, 'massProductionProb', 0.6) * factor)
    item.assumptions.offtakeCoverage = Math.min(1, numberAt(inputs, 'offtakeCoverage', 0.4) * factor)
    item.assumptions.merchantRealization = numberAt(inputs, 'merchantRealization', 1) * [1, 0.9, 0.7, 0.5][index]
    item.assumptions.costDeclineRate = numberAt(inputs, 'costDeclineRate', 0.08) * [1.3, 1, 0.65, 0.3][index]
    item.assumptions.carbonCreditPrice = numberAt(inputs, 'carbonCreditPrice', 5000) * [1.4, 1, 0.6, 0.3][index]
  })
  state.notices.push('旧Climate ScenarioからCurrent Project NPVは再現せず、0で移行しています。案件のProject NPVを入力してください。')
}

export function migrateLegacyScenario(raw: unknown): WorkbenchState {
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

  if (sector === 'saas_jp') migrateSaas(state, inputs)
  if (sector === 'ec_d2c') migrateEc(state, inputs)
  if (sector === 'media_tech') migrateMedia(state, inputs)
  if (sector === 'medical_device') migrateMedicalDevice(state, inputs)
  if (sector === 'drug_discovery') migrateDrugDiscovery(state, inputs)
  if (sector === 'climate_tech') migrateClimateTech(state, inputs)

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
