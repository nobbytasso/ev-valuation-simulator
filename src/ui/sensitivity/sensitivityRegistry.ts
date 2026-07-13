/**
 * 感度分析の消費側契約(監査ゲート条件2)。出典: docs/phase4-spec.md §1
 *
 * セクターID(SectorId、store層の永続化語彙)→(driverIds取得/applier/baseEv/表示ラベル)の
 * 対応をここに集約する。ベンチマークのUIマッピング表(*BenchmarkMetrics.ts)と同じ配置規約。
 * 計算本体(applier/baseEv/buildTornado)はすべてエンジン側に既存であり、ここは結線のみを行う。
 */
import type {
  ClimateTechInputs,
  DriverApplier,
  DrugDiscoveryInputs,
  EcD2cInputs,
  MediaTechInputs,
  MedicalDeviceInputs,
  Money,
  Ratio,
  SaasInputs,
  TornadoItem,
} from '../../engine/index.ts'
import {
  applyClimateTechDriver,
  applyDrugDiscoveryDriver,
  applyEcD2cDriver,
  applyMediaTechDriver,
  applyMedicalDeviceDriver,
  applySaasDriver,
  buildTornado,
  CLIMATE_TECH_SENSITIVITY_DRIVERS,
  climateTechBaseEv,
  DRUG_DISCOVERY_SENSITIVITY_DRIVERS,
  drugDiscoveryBaseEv,
  EC_D2C_SENSITIVITY_DRIVERS,
  ecD2cBaseEv,
  MEDIA_TECH_SENSITIVITY_DRIVERS,
  mediaTechBaseEv,
  MEDICAL_DEVICE_SENSITIVITY_DRIVERS,
  medicalDeviceBaseEv,
  SAAS_SENSITIVITY_DRIVERS,
  saasBaseEv,
} from '../../engine/index.ts'
import type { Scenario, SectorId } from '../../store/scenarioTypes.ts'
import { climateTechDriverLabel } from '../sectors/climateTech/climateTechDriverLabels.ts'
import { drugDiscoveryDriverLabel } from '../sectors/drugDiscovery/drugDiscoveryDriverLabels.ts'
import { ecD2cDriverLabel } from '../sectors/ecD2c/ecD2cDriverLabels.ts'
import { mediaTechDriverLabel } from '../sectors/mediaTech/mediaTechDriverLabels.ts'
import { medicalDeviceDriverLabel } from '../sectors/medicalDevice/medicalDeviceDriverLabels.ts'
import { saasDriverLabel } from '../sectors/saas/saasDriverLabels.ts'

/** レジストリの1エントリ。TInputs はセクターのエンジン入力型 */
export interface SectorSensitivityEntry<TInputs> {
  listDriverIds: (inputs: TInputs) => string[]
  applyDriver: DriverApplier<TInputs>
  baseEv: (inputs: TInputs) => Money
  driverLabel: (driverId: string, inputs: TInputs) => string
}

/** SectorId → エンジン入力型 の対応(Scenario ユニオンと同じ対応) */
export type SectorInputsMap = {
  saas_jp: SaasInputs
  drug_discovery: DrugDiscoveryInputs
  medical_device: MedicalDeviceInputs
  media_tech: MediaTechInputs
  ec_d2c: EcD2cInputs
  climate_tech: ClimateTechInputs
}

export type SensitivityRegistry = { [K in SectorId]: SectorSensitivityEntry<SectorInputsMap[K]> }

export const SENSITIVITY_REGISTRY: SensitivityRegistry = {
  saas_jp: {
    listDriverIds: () => [...SAAS_SENSITIVITY_DRIVERS],
    applyDriver: applySaasDriver,
    baseEv: saasBaseEv,
    driverLabel: saasDriverLabel,
  },
  drug_discovery: {
    listDriverIds: DRUG_DISCOVERY_SENSITIVITY_DRIVERS,
    applyDriver: applyDrugDiscoveryDriver,
    baseEv: drugDiscoveryBaseEv,
    driverLabel: drugDiscoveryDriverLabel,
  },
  medical_device: {
    listDriverIds: () => [...MEDICAL_DEVICE_SENSITIVITY_DRIVERS],
    applyDriver: applyMedicalDeviceDriver,
    baseEv: medicalDeviceBaseEv,
    driverLabel: medicalDeviceDriverLabel,
  },
  media_tech: {
    listDriverIds: () => [...MEDIA_TECH_SENSITIVITY_DRIVERS],
    applyDriver: applyMediaTechDriver,
    baseEv: mediaTechBaseEv,
    driverLabel: mediaTechDriverLabel,
  },
  ec_d2c: {
    listDriverIds: () => [...EC_D2C_SENSITIVITY_DRIVERS],
    applyDriver: applyEcD2cDriver,
    baseEv: ecD2cBaseEv,
    driverLabel: ecD2cDriverLabel,
  },
  climate_tech: {
    listDriverIds: () => [...CLIMATE_TECH_SENSITIVITY_DRIVERS],
    applyDriver: applyClimateTechDriver,
    baseEv: climateTechBaseEv,
    driverLabel: climateTechDriverLabel,
  },
}

export interface TornadoRow extends TornadoItem {
  label: string // T2で合成した日本語ラベル
  delta: Ratio // この行に適用した変動幅(表示用)
  isFixedDelta: boolean // 創薬 discountRate.base のみ true(δ_r=±0.02固定、U-20確定)
}

export interface SensitivityRunConfig {
  defaultDelta: Ratio // 既定 0.20
  deltaByDriverId?: Record<string, Ratio> // ドライバー毎の上書き
}

/** 創薬 discountRate.base の固定変動幅。engineのDELTA_R(drugDiscovery.ts)と同じ値(U-20確定)。 */
const DRUG_DISCOUNT_RATE_FIXED_DELTA = 0.02
const DRUG_DISCOUNT_RATE_DRIVER_ID = 'discountRate.base'

function buildRows<TInputs>(
  entry: SectorSensitivityEntry<TInputs>,
  inputs: TInputs,
  config: SensitivityRunConfig,
  isFixedDeltaDriver: (driverId: string) => boolean,
): { baseEv: Money; rows: TornadoRow[] } {
  const baseEv = entry.baseEv(inputs)
  const driverIds = entry.listDriverIds(inputs)
  const rows = driverIds.map((driverId): TornadoRow => {
    const isFixedDelta = isFixedDeltaDriver(driverId)
    // isFixedDelta のドライバーは deltaByDriverId による上書きが無効(§1.3)。
    const delta = isFixedDelta
      ? DRUG_DISCOUNT_RATE_FIXED_DELTA
      : (config.deltaByDriverId?.[driverId] ?? config.defaultDelta)
    const [item] = buildTornado(inputs, { delta, driverIds: [driverId] }, entry.applyDriver, entry.baseEv)
    return { ...item, label: entry.driverLabel(driverId, inputs), delta, isFixedDelta }
  })
  // span降順(同値は列挙順を維持。Array.prototype.sortは安定ソート)。
  rows.sort((a, b) => b.span - a.span)
  return { baseEv, rows }
}

const noFixedDelta = () => false

/** Scenario(draft入力差し替え済み)からトルネード行一式と基準EVを得るファサード(§1.3)。 */
export function buildTornadoRows(scenario: Scenario, config: SensitivityRunConfig): { baseEv: Money; rows: TornadoRow[] } {
  switch (scenario.sector) {
    case 'saas_jp':
      return buildRows(SENSITIVITY_REGISTRY.saas_jp, scenario.inputs, config, noFixedDelta)
    case 'drug_discovery':
      return buildRows(SENSITIVITY_REGISTRY.drug_discovery, scenario.inputs, config, (id) => id === DRUG_DISCOUNT_RATE_DRIVER_ID)
    case 'medical_device':
      return buildRows(SENSITIVITY_REGISTRY.medical_device, scenario.inputs, config, noFixedDelta)
    case 'media_tech':
      return buildRows(SENSITIVITY_REGISTRY.media_tech, scenario.inputs, config, noFixedDelta)
    case 'ec_d2c':
      return buildRows(SENSITIVITY_REGISTRY.ec_d2c, scenario.inputs, config, noFixedDelta)
    case 'climate_tech':
      return buildRows(SENSITIVITY_REGISTRY.climate_tech, scenario.inputs, config, noFixedDelta)
  }
}
