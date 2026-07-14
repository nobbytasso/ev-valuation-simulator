/**
 * シナリオのドメイン型。エンジンの各セクター Inputs 型をそのまま再利用する
 * (StorageAdapter/UI層とエンジン層で入力の型定義を二重管理しない)。
 */
import type {
  CapTableHolder,
  ClimateTechInputs,
  DrugDiscoveryInputs,
  EcD2cInputs,
  FundingRound,
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
 * 資本政策(希薄化シミュレーター)の入力。出典: docs/engine-spec.md §1.4、phase4-spec.md §4.1
 * エンジンの CapTableHolder / FundingRound 型をそのまま再利用する(二重管理しない)。
 * Exit年は vcMethod.yearsToExit を共用し、ここでは持たない(U-22確定・P4-5裁定)。
 */
export interface ScenarioCapitalPolicyInputs {
  initialCapTable: CapTableHolder[] // 初期持分。Σ=1(UI検証+エンジン検証validateDilutionInputs)
  rounds: FundingRound[] // 将来ラウンド列(空配列可)
  exitEvSource: 'pessimistic' | 'base' | 'optimistic' // Exit企業価値の参照レンジ点(既定 'base'、P4-4裁定)
}

/**
 * 永続化スキーマのバージョン。出典: docs/requirements-rev5.md §8、D-1裁定
 * v1: Phase 2形式(vcMethodフィールドなし)。v2: Phase 3でvcMethodを追加。
 * v3: Phase 4でcapitalPolicyを追加。
 * 形式変更時はここを+1し、src/store/scenarioMigration.ts に移行手順を追記する。
 */
export const SCENARIO_SCHEMA_VERSION = 3

interface ScenarioBase<TSector extends SectorId, TInputs> {
  id: string
  name: string
  sector: TSector
  inputs: TInputs
  vcMethod: ScenarioVcMethodInputs
  capitalPolicy: ScenarioCapitalPolicyInputs // v3で追加
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

/**
 * ポートフォリオ永続化データのスキーマバージョン。出典: docs/phase5-spec.md §3.2、§5
 * v1: Phase 2形式(investmentDateフィールドなし)。v2: Phase 5でinvestmentDateを追加。
 * 形式変更時はここを+1し、src/store/portfolioMigration.ts に移行手順を追記する。
 */
export const PORTFOLIO_SCHEMA_VERSION = 2

export interface PortfolioHolding {
  id: string
  companyName: string
  sector: SectorId
  investmentAmount: number // 百万円
  round: string // 例: "シリーズA"
  ownershipPct: number // 現在の持分比率(0-1)
  scenarioId?: string // 紐づくシナリオ(評価額の参照先)
  /**
   * 投資日(ISO8601日付)。IRR計算の起点。v2で追加。既存データは null 補完
   * (P5-3裁定: createdAtでの代替はしない。誤ったIRRを黙って出すより「未設定」を明示する)。
   */
  investmentDate: string | null
  schemaVersion: number
  createdAt: string
  updatedAt: string
}
