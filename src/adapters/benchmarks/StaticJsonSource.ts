/**
 * BenchmarkSource の Stage 1 実装。data/benchmarks/benchmarks.dummy.json を
 * ビルド時にバンドルして参照する(外部通信なし。Stage 1の「入力データはブラウザ外に
 * 出さない」原則と整合。実データ差し替え時はこのファイルのimport元を切り替えるのみ)。
 *
 * fetchSector は Promise を返す点で Stage 2 の GasEndpointSource(実際にHTTP fetchする)
 * と互換であり、呼び出し側のコードは変更不要。
 */
import benchmarksDummy from '../../../data/benchmarks/benchmarks.dummy.json'
import type { SectorId } from '../../store/scenarioTypes.ts'
import type { BenchmarkData, BenchmarkSource } from './types.ts'

interface BenchmarksFile {
  note: string
  sectors: BenchmarkData[]
}

const data = benchmarksDummy as unknown as BenchmarksFile

export class StaticJsonSource implements BenchmarkSource {
  async fetchSector(sectorId: SectorId): Promise<BenchmarkData | null> {
    return data.sectors.find((s) => s.sector === sectorId) ?? null
  }
}
