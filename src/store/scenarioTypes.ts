/**
 * シナリオのドメイン型。エンジンの各セクター Inputs 型をそのまま再利用する
 * (StorageAdapter/UI層とエンジン層で入力の型定義を二重管理しない)。
 */
import type {
  ClimateTechInputs,
  DrugDiscoveryInputs,
  EcD2cInputs,
  MediaTechInputs,
  MedicalDeviceInputs,
  SaasInputs,
} from '../engine/index.ts'

export const SECTOR_IDS = [
  'saas_jp',
  'drug_discovery',
  'medical_device',
  'media_tech',
  'ec_d2c',
  'climate_tech',
] as const

export type SectorId = (typeof SECTOR_IDS)[number]

export const SECTOR_LABELS: Record<SectorId, string> = {
  saas_jp: 'SaaS(日本)',
  drug_discovery: '創薬',
  medical_device: '医療機器',
  media_tech: 'メディアテック',
  ec_d2c: 'EC・D2C',
  climate_tech: 'クライメートテック',
}

interface ScenarioBase<TSector extends SectorId, TInputs> {
  id: string
  name: string
  sector: TSector
  inputs: TInputs
  createdAt: string // ISO8601
  updatedAt: string // ISO8601
}

export type Scenario =
  | ScenarioBase<'saas_jp', SaasInputs>
  | ScenarioBase<'drug_discovery', DrugDiscoveryInputs>
  | ScenarioBase<'medical_device', MedicalDeviceInputs>
  | ScenarioBase<'media_tech', MediaTechInputs>
  | ScenarioBase<'ec_d2c', EcD2cInputs>
  | ScenarioBase<'climate_tech', ClimateTechInputs>

export interface PortfolioHolding {
  id: string
  companyName: string
  sector: SectorId
  investmentAmount: number // 百万円
  round: string // 例: "シリーズA"
  ownershipPct: number // 現在の持分比率(0-1)
  scenarioId?: string // 紐づくシナリオ(評価額の参照先)
  createdAt: string
  updatedAt: string
}
