import {
  workbenchClimateTechExit,
  workbenchDrugDiscoveryExit,
  workbenchEcD2cExit,
  workbenchMediaTechExit,
  workbenchMedicalDeviceExit,
  workbenchSaasExit,
} from '../../engine/workbench/sectors.ts'
import type {
  InvestmentCase,
  SectorDefinition,
  V2SectorId,
  ValueBag,
  WorkbenchState,
} from './types.ts'
import { buildCaseResult, numberValue, stringValue } from './valuation.ts'

const commonCaseNames = ['会社計画', '引受ケース', 'Downside', 'Severe Downside'] as const

function caseAssumptions(values: ValueBag[]): ValueBag[] {
  if (values.length !== 4) throw new Error('defaultCaseAssumptions must contain four cases')
  return values
}

const definitions: Record<V2SectorId, SectorDefinition> = {
  saas_jp: {
    id: 'saas_jp',
    label: 'SaaS（日本）',
    valuationMethod: 'Exit ARR × EV/ARR',
    formulaSummary: '現在ARRをExit年まで成長させ、Exit ARRにEV/ARRマルチプルを適用します。',
    companyFields: [
      { id: 'currentArr', label: '現在ARR', format: 'money', step: 100, min: 0 },
    ],
    caseFields: [
      { id: 'arrGrowth', label: '初年度ARR成長率', format: 'percent', step: 1 },
      { id: 'growthDecay', label: '成長率の年次減衰係数', format: 'percent', step: 1, min: 0, max: 1 },
      { id: 'exitOperatingMargin', label: 'Exit時営業利益率', format: 'percent', step: 1 },
      { id: 'exitMultiple', label: 'Exit EV/ARR', format: 'multiple', step: 0.1, min: 0 },
    ],
    defaultCompanyFacts: { currentArr: 1000 },
    defaultCaseAssumptions: caseAssumptions([
      { arrGrowth: 0.35, growthDecay: 0.9, exitOperatingMargin: 0.15, exitMultiple: 10 },
      { arrGrowth: 0.25, growthDecay: 0.85, exitOperatingMargin: 0.12, exitMultiple: 7 },
      { arrGrowth: 0.12, growthDecay: 0.8, exitOperatingMargin: 0.05, exitMultiple: 4.5 },
      { arrGrowth: 0.02, growthDecay: 0.75, exitOperatingMargin: -0.05, exitMultiple: 2.5 },
    ]),
    evaluate(company, investmentCase) {
      const exit = workbenchSaasExit({
        currentArr: numberValue(company.facts, 'currentArr'),
        arrGrowth: numberValue(investmentCase.assumptions, 'arrGrowth'),
        growthDecay: numberValue(investmentCase.assumptions, 'growthDecay', 1),
        exitOperatingMargin: numberValue(investmentCase.assumptions, 'exitOperatingMargin'),
        exitMultiple: numberValue(investmentCase.assumptions, 'exitMultiple'),
        yearsToExit: investmentCase.yearsToExit,
      })
      return buildCaseResult(company, investmentCase, exit)
    },
  },

  ec_d2c: {
    id: 'ec_d2c',
    label: 'EC・D2C',
    valuationMethod: 'Exit売上または粗利 × Exit Multiple',
    formulaSummary: '売上をExit年まで成長させ、売上または粗利を基準にExitマルチプルを適用します。',
    companyFields: [
      { id: 'currentRevenue', label: '現在年間売上', format: 'money', step: 100, min: 0 },
      { id: 'currentGrossMargin', label: '現在粗利率', format: 'percent', step: 1, min: 0, max: 1 },
    ],
    caseFields: [
      { id: 'revenueGrowth', label: '初年度売上成長率', format: 'percent', step: 1 },
      { id: 'growthDecay', label: '成長率の年次減衰係数', format: 'percent', step: 1, min: 0, max: 1 },
      { id: 'exitGrossMargin', label: 'Exit時粗利率', format: 'percent', step: 1, min: 0, max: 1 },
      {
        id: 'multipleBasis',
        label: 'マルチプル基準',
        kind: 'select',
        options: [
          { value: 'revenue', label: '売上' },
          { value: 'grossProfit', label: '粗利' },
        ],
      },
      { id: 'exitMultiple', label: 'Exit Multiple', format: 'multiple', step: 0.1, min: 0 },
    ],
    defaultCompanyFacts: { currentRevenue: 2000, currentGrossMargin: 0.45 },
    defaultCaseAssumptions: caseAssumptions([
      { revenueGrowth: 0.3, growthDecay: 0.9, exitGrossMargin: 0.55, multipleBasis: 'revenue', exitMultiple: 3.5 },
      { revenueGrowth: 0.2, growthDecay: 0.85, exitGrossMargin: 0.5, multipleBasis: 'revenue', exitMultiple: 2.2 },
      { revenueGrowth: 0.08, growthDecay: 0.8, exitGrossMargin: 0.43, multipleBasis: 'revenue', exitMultiple: 1.2 },
      { revenueGrowth: -0.05, growthDecay: 0.8, exitGrossMargin: 0.35, multipleBasis: 'grossProfit', exitMultiple: 1.5 },
    ]),
    evaluate(company, investmentCase) {
      const basis = stringValue(investmentCase.assumptions, 'multipleBasis', 'revenue') as
        | 'revenue'
        | 'grossProfit'
      const exit = workbenchEcD2cExit({
        currentRevenue: numberValue(company.facts, 'currentRevenue'),
        revenueGrowth: numberValue(investmentCase.assumptions, 'revenueGrowth'),
        growthDecay: numberValue(investmentCase.assumptions, 'growthDecay', 1),
        exitGrossMargin: numberValue(investmentCase.assumptions, 'exitGrossMargin'),
        multipleBasis: basis,
        exitMultiple: numberValue(investmentCase.assumptions, 'exitMultiple'),
        yearsToExit: investmentCase.yearsToExit,
      })
      return buildCaseResult(company, investmentCase, exit)
    },
  },

  media_tech: {
    id: 'media_tech',
    label: 'メディアテック',
    valuationMethod: 'Exit MAU × Exit ARPU × 12 × EV/Sales',
    formulaSummary: 'MAUとARPUをExit年まで独立に成長させ、Exit売上にEV/Salesを適用します。',
    companyFields: [
      { id: 'currentMau', label: '現在MAU', format: 'number', step: 10000, min: 0 },
      { id: 'currentMonthlyArpu', label: '現在月次ARPU', format: 'yen', step: 10, min: 0 },
    ],
    caseFields: [
      { id: 'mauGrowth', label: '初年度MAU成長率', format: 'percent', step: 1 },
      { id: 'growthDecay', label: 'MAU成長率の年次減衰係数', format: 'percent', step: 1, min: 0, max: 1 },
      { id: 'arpuGrowth', label: 'ARPU年次成長率', format: 'percent', step: 1 },
      { id: 'exitMultiple', label: 'Exit EV/Sales', format: 'multiple', step: 0.1, min: 0 },
    ],
    defaultCompanyFacts: { currentMau: 2_000_000, currentMonthlyArpu: 170 },
    defaultCaseAssumptions: caseAssumptions([
      { mauGrowth: 0.35, growthDecay: 0.9, arpuGrowth: 0.08, exitMultiple: 6 },
      { mauGrowth: 0.22, growthDecay: 0.85, arpuGrowth: 0.04, exitMultiple: 4 },
      { mauGrowth: 0.08, growthDecay: 0.8, arpuGrowth: 0, exitMultiple: 2.2 },
      { mauGrowth: -0.08, growthDecay: 0.8, arpuGrowth: -0.03, exitMultiple: 1.2 },
    ]),
    evaluate(company, investmentCase) {
      const exit = workbenchMediaTechExit({
        currentMau: numberValue(company.facts, 'currentMau'),
        mauGrowth: numberValue(investmentCase.assumptions, 'mauGrowth'),
        growthDecay: numberValue(investmentCase.assumptions, 'growthDecay', 1),
        currentMonthlyArpu: numberValue(company.facts, 'currentMonthlyArpu'),
        arpuGrowth: numberValue(investmentCase.assumptions, 'arpuGrowth'),
        exitMultiple: numberValue(investmentCase.assumptions, 'exitMultiple'),
        yearsToExit: investmentCase.yearsToExit,
      })
      return buildCaseResult(company, investmentCase, exit)
    },
  },

  medical_device: {
    id: 'medical_device',
    label: '医療機器',
    valuationMethod: 'Current DCF + Exit売上 × EV/Sales',
    formulaSummary: '現在価値は市場浸透DCF、投資リターンはExit年売上に取引マルチプルを適用して分離表示します。',
    companyFields: [
      { id: 'annualProcedures', label: '現在年間対象手技数', format: 'number', step: 100, min: 0 },
      { id: 'pricePerProcedure', label: '手技当たり売上', format: 'yen', step: 1000, min: 0 },
      { id: 'launchYear', label: '基準上市年', format: 'number', step: 1, min: 0 },
      { id: 'recurringRatio', label: 'リカーリング売上比率', format: 'percent', step: 1, min: 0, max: 0.95 },
    ],
    caseFields: [
      { id: 'procedureGrowth', label: '対象手技数成長率', format: 'percent', step: 1 },
      { id: 'approvalDelayYears', label: '承認・償還遅延年数', format: 'number', step: 1, min: 0 },
      { id: 'peakPenetration', label: 'ピーク浸透率', format: 'percent', step: 1, min: 0, max: 1 },
      { id: 'yearsToPeak', label: 'ピーク到達年数', format: 'number', step: 1, min: 1 },
      { id: 'operatingMargin', label: '営業CFマージン', format: 'percent', step: 1 },
      { id: 'discountRate', label: '現在価値の割引率', format: 'percent', step: 1 },
      { id: 'terminalGrowth', label: '永久成長率', format: 'percent', step: 0.5 },
      { id: 'exitMultiple', label: 'Exit EV/Sales', format: 'multiple', step: 0.1, min: 0 },
    ],
    defaultCompanyFacts: {
      annualProcedures: 15000,
      pricePerProcedure: 150000,
      launchYear: 2,
      recurringRatio: 0.2,
    },
    defaultCaseAssumptions: caseAssumptions([
      { procedureGrowth: 0.08, approvalDelayYears: 0, peakPenetration: 0.4, yearsToPeak: 3, operatingMargin: 0.22, discountRate: 0.1, terminalGrowth: 0.02, exitMultiple: 5 },
      { procedureGrowth: 0.05, approvalDelayYears: 1, peakPenetration: 0.3, yearsToPeak: 4, operatingMargin: 0.17, discountRate: 0.12, terminalGrowth: 0.02, exitMultiple: 4.5 },
      { procedureGrowth: 0.03, approvalDelayYears: 2, peakPenetration: 0.2, yearsToPeak: 5, operatingMargin: 0.1, discountRate: 0.14, terminalGrowth: 0.015, exitMultiple: 2.2 },
      { procedureGrowth: 0, approvalDelayYears: 4, peakPenetration: 0.1, yearsToPeak: 6, operatingMargin: 0.05, discountRate: 0.16, terminalGrowth: 0.01, exitMultiple: 1.2 },
    ]),
    evaluate(company, investmentCase) {
      const exit = workbenchMedicalDeviceExit({
        annualProcedures: numberValue(company.facts, 'annualProcedures'),
        pricePerProcedure: numberValue(company.facts, 'pricePerProcedure'),
        launchYear: numberValue(company.facts, 'launchYear'),
        recurringRatio: numberValue(company.facts, 'recurringRatio'),
        procedureGrowth: numberValue(investmentCase.assumptions, 'procedureGrowth'),
        approvalDelayYears: numberValue(investmentCase.assumptions, 'approvalDelayYears'),
        peakPenetration: numberValue(investmentCase.assumptions, 'peakPenetration'),
        yearsToPeak: Math.max(1, numberValue(investmentCase.assumptions, 'yearsToPeak', 1)),
        operatingMargin: numberValue(investmentCase.assumptions, 'operatingMargin'),
        discountRate: numberValue(investmentCase.assumptions, 'discountRate'),
        terminalGrowth: numberValue(investmentCase.assumptions, 'terminalGrowth'),
        exitMultiple: numberValue(investmentCase.assumptions, 'exitMultiple'),
        yearsToExit: investmentCase.yearsToExit,
      })
      return buildCaseResult(company, investmentCase, exit)
    },
  },

  drug_discovery: {
    id: 'drug_discovery',
    label: '創薬',
    valuationMethod: 'Current rNPV + Exit時リスク調整経済価値',
    formulaSummary: '現在rNPVと、Exit時ピーク売上・価値帰属率・成功確率・取引倍率による将来イベント価値を分離します。',
    companyFields: [
      { id: 'currentRnpv', label: '現在rNPV', format: 'money', step: 100, min: 0 },
      { id: 'currentPeakSales', label: '現在想定ピーク売上', format: 'money', step: 100, min: 0 },
    ],
    caseFields: [
      { id: 'peakSalesGrowth', label: 'ピーク売上想定の年次変化率', format: 'percent', step: 1 },
      { id: 'posAtExit', label: 'Exit時点の上市成功確率', format: 'percent', step: 1, min: 0, max: 1 },
      { id: 'valueCaptureRate', label: '売上価値の自社帰属率', format: 'percent', step: 1, min: 0, max: 1 },
      { id: 'exitMultiple', label: 'リスク調整経済価値倍率', format: 'multiple', step: 0.1, min: 0 },
    ],
    defaultCompanyFacts: { currentRnpv: 1200, currentPeakSales: 5000 },
    defaultCaseAssumptions: caseAssumptions([
      { peakSalesGrowth: 0.08, posAtExit: 0.75, valueCaptureRate: 0.65, exitMultiple: 3.5 },
      { peakSalesGrowth: 0.03, posAtExit: 0.55, valueCaptureRate: 0.5, exitMultiple: 2.5 },
      { peakSalesGrowth: -0.05, posAtExit: 0.25, valueCaptureRate: 0.35, exitMultiple: 1.5 },
      { peakSalesGrowth: -0.1, posAtExit: 0.05, valueCaptureRate: 0.25, exitMultiple: 0.8 },
    ]),
    evaluate(company, investmentCase) {
      const exit = workbenchDrugDiscoveryExit({
        currentRnpv: numberValue(company.facts, 'currentRnpv'),
        currentPeakSales: numberValue(company.facts, 'currentPeakSales'),
        peakSalesGrowth: numberValue(investmentCase.assumptions, 'peakSalesGrowth'),
        yearsToExit: investmentCase.yearsToExit,
        posAtExit: numberValue(investmentCase.assumptions, 'posAtExit'),
        valueCaptureRate: numberValue(investmentCase.assumptions, 'valueCaptureRate'),
        exitMultiple: numberValue(investmentCase.assumptions, 'exitMultiple'),
      })
      return buildCaseResult(company, investmentCase, exit)
    },
  },

  climate_tech: {
    id: 'climate_tech',
    label: 'クライメートテック',
    valuationMethod: 'Current Project NPV + Exit EBITDA × Multiple',
    formulaSummary: '現在Project NPVと、量産時の確率調整後Exit EBITDAに取引マルチプルを適用した将来価値を分離します。',
    companyFields: [
      { id: 'currentProjectNpv', label: '現在Project NPV', format: 'money', step: 100 },
      { id: 'annualCapacity', label: '年間生産能力', format: 'number', step: 10000, min: 0 },
      { id: 'unitPrice', label: '販売単価', format: 'yen', step: 100, min: 0 },
      { id: 'unitCost', label: '現在ユニットコスト', format: 'yen', step: 100, min: 0 },
      { id: 'fixedOpex', label: '年間固定費', format: 'money', step: 100, min: 0 },
      { id: 'carbonCreditVolume', label: '年間クレジット量', format: 'number', step: 10000, min: 0 },
    ],
    caseFields: [
      { id: 'massProductionProbability', label: '量産化到達確率', format: 'percent', step: 1, min: 0, max: 1 },
      { id: 'offtakeCoverage', label: 'オフテイクカバー率', format: 'percent', step: 1, min: 0, max: 1 },
      { id: 'merchantRealization', label: '非オフテイク分販売実現率', format: 'percent', step: 1, min: 0, max: 1 },
      { id: 'costDeclineRate', label: 'ユニットコスト年次低減率', format: 'percent', step: 1, min: 0, max: 0.99 },
      { id: 'carbonCreditPrice', label: 'カーボンクレジット価格', format: 'yen', step: 100, min: 0 },
      { id: 'exitMultiple', label: 'Exit EV/EBITDA', format: 'multiple', step: 0.1, min: 0 },
    ],
    defaultCompanyFacts: {
      currentProjectNpv: 800,
      annualCapacity: 450000,
      unitPrice: 8000,
      unitCost: 9000,
      fixedOpex: 500,
      carbonCreditVolume: 100000,
    },
    defaultCaseAssumptions: caseAssumptions([
      { massProductionProbability: 0.85, offtakeCoverage: 0.8, merchantRealization: 1, costDeclineRate: 0.12, carbonCreditPrice: 7000, exitMultiple: 8 },
      { massProductionProbability: 0.6, offtakeCoverage: 0.5, merchantRealization: 0.9, costDeclineRate: 0.08, carbonCreditPrice: 5000, exitMultiple: 6 },
      { massProductionProbability: 0.35, offtakeCoverage: 0.3, merchantRealization: 0.7, costDeclineRate: 0.05, carbonCreditPrice: 3000, exitMultiple: 4 },
      { massProductionProbability: 0.15, offtakeCoverage: 0.1, merchantRealization: 0.5, costDeclineRate: 0.02, carbonCreditPrice: 1500, exitMultiple: 2.5 },
    ]),
    evaluate(company, investmentCase) {
      const exit = workbenchClimateTechExit({
        currentProjectNpv: numberValue(company.facts, 'currentProjectNpv'),
        annualCapacity: numberValue(company.facts, 'annualCapacity'),
        unitPrice: numberValue(company.facts, 'unitPrice'),
        unitCost: numberValue(company.facts, 'unitCost'),
        fixedOpex: numberValue(company.facts, 'fixedOpex'),
        carbonCreditVolume: numberValue(company.facts, 'carbonCreditVolume'),
        massProductionProbability: numberValue(investmentCase.assumptions, 'massProductionProbability'),
        offtakeCoverage: numberValue(investmentCase.assumptions, 'offtakeCoverage'),
        merchantRealization: numberValue(investmentCase.assumptions, 'merchantRealization'),
        costDeclineRate: numberValue(investmentCase.assumptions, 'costDeclineRate'),
        carbonCreditPrice: numberValue(investmentCase.assumptions, 'carbonCreditPrice'),
        exitMultiple: numberValue(investmentCase.assumptions, 'exitMultiple'),
        yearsToExit: investmentCase.yearsToExit,
      })
      return buildCaseResult(company, investmentCase, exit)
    },
  },
}

export const V2_SECTOR_LABELS: Record<V2SectorId, string> = Object.fromEntries(
  Object.values(definitions).map((definition) => [definition.id, definition.label]),
) as Record<V2SectorId, string>

export function getSectorDefinition(sector: V2SectorId): SectorDefinition {
  return definitions[sector]
}

function createDefaultCases(definition: SectorDefinition): InvestmentCase[] {
  const common = [
    { narrative: '経営計画を概ね達成し、良好な市場環境でExitするケース。', exitRoute: 'ipo' as const },
    { narrative: '投資委員会で採用する引受前提。実行確度と評価水準を保守的に調整。', exitRoute: 'ipo' as const },
    { narrative: '成長鈍化、実行遅延、マルチプル低下を織り込むケース。', exitRoute: 'ma' as const },
    { narrative: '事業停滞または主要マイルストーン未達を織り込むケース。', exitRoute: 'ma' as const },
  ]

  return commonCaseNames.map((name, index) => ({
    id: crypto.randomUUID(),
    name,
    narrative: common[index].narrative,
    exitRoute: common[index].exitRoute,
    yearsToExit: index < 2 ? 5 : index === 2 ? 6 : 7,
    targetMoic: 10,
    investmentAmount: 300,
    dilutionRetention: index < 2 ? 0.7 : index === 2 ? 0.6 : 0.5,
    exitNetDebt: 0,
    assumptions: structuredClone(definition.defaultCaseAssumptions[index]),
  }))
}

export function createDefaultWorkbench(
  sector: V2SectorId = 'saas_jp',
  companyName = 'サンプル投資先',
): WorkbenchState {
  const definition = getSectorDefinition(sector)
  const now = new Date()
  return {
    schemaVersion: 2,
    company: {
      id: crypto.randomUUID(),
      name: companyName,
      sector,
      valuationDate: now.toISOString().slice(0, 10),
      fullyDilutedShares: 10,
      proposedPreMoney: 3000,
      currentNetDebt: 0,
      facts: structuredClone(definition.defaultCompanyFacts),
    },
    cases: createDefaultCases(definition),
    notices: [],
    updatedAt: now.toISOString(),
    adoptedCaseId: null,
  }
}

export function resetForSector(current: WorkbenchState, sector: V2SectorId): WorkbenchState {
  const next = createDefaultWorkbench(sector, current.company.name)
  next.company.valuationDate = current.company.valuationDate
  next.company.fullyDilutedShares = current.company.fullyDilutedShares
  next.company.proposedPreMoney = current.company.proposedPreMoney
  next.company.currentNetDebt = current.company.currentNetDebt
  return next
}
