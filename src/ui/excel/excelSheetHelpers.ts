/**
 * Excelワークブック構築の共通ヘルパー(純粋関数)。出典: docs/phase5-spec.md §4.1, §1.2
 * buildScenarioWorkbook・buildCompareWorkbook・buildPortfolioWorkbook から共有する
 * (シナリオの前提条件展開ロジックを複製しない)。
 */
import type { DataStatus } from '../../adapters/benchmarks/types.ts'
import type { Scenario } from '../../store/scenarioTypes.ts'
import { SECTOR_LABELS } from '../../store/scenarioTypes.ts'
import { FIELD_LABEL_TABLES } from '../scenarioEvaluation/fieldLabelTables.ts'
import type { FieldLabelEntry } from '../scenarioEvaluation/fieldLabelTypes.ts'
import { getByPath } from '../scenarioEvaluation/getByPath.ts'
import { PHASE_LABELS } from '../sectors/drugDiscovery/phaseLabels.ts'

export type SheetRow = (string | number)[]

export function formatDataStatus(status: DataStatus | 'unknown'): string {
  if (status === 'dummy') return 'ダミーデータ(実データではない)'
  if (status === 'production') return '実データ'
  return '不明(未取得)'
}

/** スカラー入力1件を [ラベル, 値, 単位] の行に変換する。文字列フィールド(select/text)は値をそのまま出力する。 */
export function scalarFieldRow(inputs: unknown, path: string, entry: FieldLabelEntry): SheetRow {
  const raw = getByPath(inputs, path)
  if (typeof raw === 'string') return [entry.label, raw, entry.unit]
  if (typeof raw !== 'number') return [entry.label, '', entry.unit]
  const value = entry.format === 'ratio' ? raw * 100 : raw
  return [entry.label, value, entry.unit]
}

/**
 * シナリオ1件分の前提条件展開(§1.2のフィールドラベル表による全入力、配列はブロック展開)。
 * シナリオ単票では単独シートとして、比較表ではシナリオ毎に縦連結して使う(§4.2)。
 */
export function buildScenarioAssumptionRows(scenario: Scenario, benchmarkDataStatus: DataStatus | 'unknown'): SheetRow[] {
  const rows: SheetRow[] = []
  rows.push(['シナリオ名', scenario.name])
  rows.push(['セクター', SECTOR_LABELS[scenario.sector]])
  rows.push(['schemaVersion', scenario.schemaVersion])
  rows.push(['ベンチマークデータの状態', formatDataStatus(benchmarkDataStatus)])
  rows.push([])

  const table = FIELD_LABEL_TABLES[scenario.sector]
  rows.push(['入力(スカラー)'])
  rows.push(['項目', '値', '単位'])
  for (const [path, entry] of Object.entries(table.scalars)) {
    rows.push(scalarFieldRow(scenario.inputs, path, entry))
  }

  for (const [arrayField, arrayLabels] of Object.entries(table.arrays)) {
    const items = getByPath(scenario.inputs, arrayField)
    if (!Array.isArray(items)) continue
    rows.push([])
    if (arrayLabels.kind === 'assetBlock') {
      items.forEach((item: unknown, i: number) => {
        const name = typeof (item as { name?: unknown }).name === 'string' ? (item as { name: string }).name : `品目${i + 1}`
        rows.push([`品目${i + 1}: ${name}`])
        for (const [path, entry] of Object.entries(arrayLabels.itemFields)) {
          rows.push(scalarFieldRow(item, path, entry))
        }
        // 導出(license)時のマイルストーンは疎な二段ネストのため、既存のPHASE_LABELSと
        // 「金額」表記を直接使って展開する(独立したラベルエントリは設けない。C2実装判断参照)。
        const commercialization = (item as { commercialization?: { type?: string; milestones?: { phase: string; amount: number }[] } })
          .commercialization
        if (commercialization?.type === 'license' && Array.isArray(commercialization.milestones)) {
          for (const m of commercialization.milestones) {
            const timing = m.phase === 'launch' ? '上市時' : `${PHASE_LABELS[m.phase as keyof typeof PHASE_LABELS]}完了時`
            rows.push([`マイルストーン(${timing})`, m.amount, '百万円'])
          }
        }
      })
    } else {
      rows.push(Object.values(arrayLabels.itemFields).map((f) => `${f.label}(${f.unit})`))
      for (const item of items) {
        rows.push(
          Object.keys(arrayLabels.itemFields).map((path) => {
            const raw = getByPath(item, path)
            return typeof raw === 'number' ? raw : ''
          }),
        )
      }
    }
  }
  return rows
}
