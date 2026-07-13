/**
 * シナリオ新規作成時のセクター別デフォルト入力値。
 * docs/engine-spec.md §2 の定義域内に収まる、妥当な仮値(Phase 3でフォームUIに置き換えるまでの繋ぎ)。
 */
import type {
  ClimateTechInputs,
  DrugDiscoveryInputs,
  EcD2cInputs,
  MediaTechInputs,
  MedicalDeviceInputs,
  SaasInputs,
} from '../engine/index.ts'
import type { Scenario, SectorId } from './scenarioTypes.ts'

function defaultSaasInputs(): SaasInputs {
  return {
    arr: 1000,
    arrGrowth: 0.3,
    nrr: 1.1,
    grossMargin: 0.7,
    operatingMargin: 0.05,
    fcfMargin: 0.05,
    grossChurn: 0.1,
    cacPaybackMonths: 18,
    arrBasis: 'ntm',
    evArrMultiple: { pessimistic: 5, base: 8, optimistic: 12 },
    projectionYears: 5,
    growthDecayFactor: 0.85,
    discountRate: 0.12,
    terminalGrowth: 0.02,
  }
}

function defaultDrugDiscoveryInputs(): DrugDiscoveryInputs {
  return {
    assets: [
      {
        name: 'パイプライン品目A',
        currentPhase: 'phase2',
        phaseSuccessProbs: {
          preclinical: 0.5,
          phase1: 0.6,
          phase2: 0.35,
          phase3: 0.6,
          filing: 0.85,
        },
        phaseDurations: { preclinical: 2, phase1: 2, phase2: 2, phase3: 3, filing: 1 },
        developmentCosts: { preclinical: 400, phase1: 900, phase2: 2000, phase3: 5000, filing: 400 },
        launchYear: 6,
        peakSales: 3000,
        yearsToPeak: 3,
        plateauYears: 3,
        declineRate: 0.1,
        commercialization: { type: 'own', contributionMargin: 0.65 },
      },
    ],
    discountRate: { pessimistic: 0.12, base: 0.11, optimistic: 0.1 },
    modelHorizonYears: 15,
  }
}

function defaultMedicalDeviceInputs(): MedicalDeviceInputs {
  return {
    annualProcedures: 5000,
    procedureGrowth: 0.05,
    deviceClass: 'II',
    launchYear: 2,
    approvalDelayYears: 0,
    pricePerProcedure: 150000,
    peakPenetration: 0.3,
    yearsToPeak: 4,
    recurringRatio: 0.2,
    operatingMargin: 0.15,
    discountRate: { pessimistic: 0.14, base: 0.12, optimistic: 0.1 },
    projectionYears: 10,
    terminalGrowth: 0.02,
  }
}

function defaultMediaTechInputs(): MediaTechInputs {
  return {
    mau: 2_000_000,
    mauGrowth: 0.3,
    growthDecayFactor: 0.85,
    dauMauRatio: 0.4,
    arpuMonthly: { ad: 100, paid: 50, commerce: 20 },
    monthlyChurn: 0.05,
    contentCostRatio: 0.3,
    cpa: 800,
    evSalesMultiple: { pessimistic: 3, base: 5, optimistic: 8 },
    projectionYears: 3,
  }
}

function defaultEcD2cInputs(): EcD2cInputs {
  return {
    annualRevenue: 2000,
    revenueGrowth: 0.25,
    grossMargin: 0.45,
    f2Rate: 0.35,
    aov: 8000,
    purchaseFrequency: 2.5,
    cac: 4000,
    adCostRatio: 0.15,
    logisticsCostRatio: 0.1,
    inventoryTurnover: 6,
    multipleBasis: 'revenue',
    evMultiple: { pessimistic: 1.5, base: 2.5, optimistic: 4 },
    maxLifetimeYears: 10,
  }
}

function defaultClimateTechInputs(): ClimateTechInputs {
  return {
    capexSchedule: [
      { yearIndex: 0, amount: 2000 },
      { yearIndex: 1, amount: 1500 },
    ],
    subsidyCoverage: 0.2,
    massProductionYear: 4,
    massProductionProb: 0.6,
    annualCapacityUnits: 200000,
    rampYears: 2,
    unitPrice: 8000,
    unitCost0: 9000,
    costDeclineRate: 0.08,
    offtakeCoverage: 0.4,
    merchantRealization: 1.0,
    fixedOpexAnnual: 500,
    carbonCreditVolume: 100000,
    carbonCreditPrice: 5000,
    discountRate: { pessimistic: 0.12, base: 0.1, optimistic: 0.08 },
    projectYears: 20,
  }
}

/** 新規シナリオを、指定セクターの妥当なデフォルト入力値つきで生成する。 */
export function createScenario(sector: SectorId, name: string): Scenario {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const base = { id, name, createdAt: now, updatedAt: now }
  switch (sector) {
    case 'saas_jp':
      return { ...base, sector, inputs: defaultSaasInputs() }
    case 'drug_discovery':
      return { ...base, sector, inputs: defaultDrugDiscoveryInputs() }
    case 'medical_device':
      return { ...base, sector, inputs: defaultMedicalDeviceInputs() }
    case 'media_tech':
      return { ...base, sector, inputs: defaultMediaTechInputs() }
    case 'ec_d2c':
      return { ...base, sector, inputs: defaultEcD2cInputs() }
    case 'climate_tech':
      return { ...base, sector, inputs: defaultClimateTechInputs() }
  }
}
