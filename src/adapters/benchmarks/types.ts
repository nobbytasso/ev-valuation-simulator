/**
 * ベンチマークデータ型。出典: data/benchmarks/benchmark.schema.json (v1.2)
 */
import type { SectorId } from '../../store/scenarioTypes.ts'

/** jpy = 円建て単価(ARPU・注文単価等。v1.2追加) */
export type BenchmarkUnit = 'percent' | 'ratio' | 'x_multiple' | 'jpy' | 'jpy_mn' | 'usd_mn' | 'months' | 'years' | 'count'
export type BenchmarkReferenceType = 'industry_standard' | 'comp_company'
export type DataStatus = 'dummy' | 'production'

export interface BenchmarkSourceInfo {
  name: string
  url: string | null
  retrieved_at: string
  license_note?: string | null
}

export interface BenchmarkEntry {
  metric_id: string
  label_ja: string
  unit: BenchmarkUnit
  reference_type: BenchmarkReferenceType
  company_name: string | null
  value: number
  basis?: string | null
  /** 指標の定義(分子/分母/基準時点)。v1.2追加、実データでは必須 */
  definition?: string | null
  source: BenchmarkSourceInfo
  notes?: string | null
}

export interface BenchmarkData {
  schema_version: string
  sector: SectorId
  sector_label_ja: string
  data_status: DataStatus
  as_of: string
  benchmarks: BenchmarkEntry[]
}

/**
 * ベンチマーク取得インターフェース。
 * 出典: docs/requirements-rev4.md §2「移行容易性の要」
 * Stage 1: StaticJsonSource → Stage 2: GasEndpointSource に差し替え可能なよう、
 * UI・エンジンはこのインターフェースのみに依存する。
 */
export interface BenchmarkSource {
  fetchSector(sectorId: SectorId): Promise<BenchmarkData | null>
}
