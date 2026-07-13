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

/**
 * VC法(共通オーバーレイ)の入力。出典: docs/engine-spec.md §1.2
 * exitEnterpriseValue はセクターモデルのEVレンジ各点から都度接続するため、ここでは保持しない。
 */
export interface ScenarioVcMethodInputs {
  targetMultiple: number // 目標倍率(> 0)。例: 10
  yearsToExit: number // > 0
  investment: number // 今回投資額(百万円)
  dilutionRetention: number // Exit時までの持分残存率(0,1]。希薄化シムから接続、手入力も可
  netDebtAtExit: number // 既定 0
}

/**
 * 永続化スキーマのバージョン。出典: docs/requirements-rev5.md §8、D-1裁定
 * v1: Phase 2形式(vcMethodフィールドなし)。v2: Phase 3でvcMethodを追加。
 * 形式変更時はここを+1し、src/store/scenarioMigration.ts に移行手順を追記する。
 */
export const SCENARIO_SCHEMA_VERSION = 2

interface ScenarioBase<TSector extends SectorId, TInputs> {
  id: string
  name: string
  sector: TSector
  inputs: TInputs
  vcMethod: ScenarioVcMethodInputs
  schemaVersion: number
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

/** ポートフォリオ永続化データのスキーマバージョン。現行 1(形式変更なし)。 */
export const PORTFOLIO_SCHEMA_VERSION = 1

export interface PortfolioHolding {
  id: string
  companyName: string
  sector: SectorId
  investmentAmount: number // 百万円
  round: string // 例: "シリーズA"
  ownershipPct: number // 現在の持分比率(0-1)
  scenarioId?: string // 紐づくシナリオ(評価額の参照先)
  schemaVersion: number
  createdAt: string
  updatedAt: string
}
