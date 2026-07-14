/**
 * シナリオ単票のExcelワークブック構築(純粋関数)。出典: docs/phase5-spec.md §4.1, §4.2
 *
 * xlsx の import はこのディレクトリに閉じる(エンジン・store・他UIから直接依存しない)。
 * ワークブック構築はBlob化と分離した純粋関数とし、XLSX.readでの読み戻しテストで検証する。
 * 数値セルは数値型で出力する(検収条件。%はヘッダに明記した上で百分率数値、金額は百万円)。
 */
import * as XLSX from 'xlsx'
import type { WorkBook } from 'xlsx'
import type { DataStatus } from '../../adapters/benchmarks/types.ts'
import { computeVcMethod, validateDilutionInputs, simulateDilution } from '../../engine/index.ts'
import type { DilutionInputs, VcMethodResult } from '../../engine/index.ts'
import type { Scenario } from '../../store/scenarioTypes.ts'
import { SECTOR_LABELS } from '../../store/scenarioTypes.ts'
import { buildOwnershipMatrix } from '../capitalPolicy/ownershipMatrix.ts'
import { evaluateScenario } from '../scenarioEvaluation/evaluateScenario.ts'
import { FIELD_LABEL_TABLES } from '../scenarioEvaluation/fieldLabelTables.ts'
import type { FieldLabelEntry } from '../scenarioEvaluation/fieldLabelTypes.ts'
import { getByPath } from '../scenarioEvaluation/getByPath.ts'
import { KEY_METRICS_LABELS } from '../scenarioEvaluation/keyMetricsLabels.ts'
import { PHASE_LABELS } from '../sectors/drugDiscovery/phaseLabels.ts'
import { buildTornadoRows } from '../sensitivity/sensitivityRegistry.ts'

type SheetRow = (string | number)[]

const RANGE_KEYS = ['pessimistic', 'base', 'optimistic'] as const
const SENSITIVITY_TOP_N = 10 // P5-8: 感度分析は上位10行

function formatDataStatus(status: DataStatus | 'unknown'): string {
  if (status === 'dummy') return 'ダミーデータ(実データではない)'
  if (status === 'production') return '実データ'
  return '不明(未取得)'
}

/** スカラー入力1件を [ラベル, 値, 単位] の行に変換する。文字列フィールド(select/text)は値をそのまま出力する。 */
function scalarFieldRow(inputs: unknown, path: string, entry: FieldLabelEntry): SheetRow {
  const raw = getByPath(inputs, path)
  if (typeof raw === 'string') return [entry.label, raw, entry.unit]
  if (typeof raw !== 'number') return [entry.label, '', entry.unit]
  const value = entry.format === 'ratio' ? raw * 100 : raw
  return [entry.label, value, entry.unit]
}

function buildAssumptionsSheetRows(scenario: Scenario, benchmarkDataStatus: DataStatus | 'unknown'): SheetRow[] {
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
        rows.push(Object.keys(arrayLabels.itemFields).map((path) => {
          const raw = getByPath(item, path)
          return typeof raw === 'number' ? raw : ''
        }))
      }
    }
  }
  return rows
}

function buildResultsSheetRows(scenario: Scenario): SheetRow[] {
  const rows: SheetRow[] = []
  rows.push(['シナリオ名', scenario.name])
  rows.push(['セクター', SECTOR_LABELS[scenario.sector]])
  rows.push([])

  const evaluation = evaluateScenario(scenario)
  if (!evaluation.ok) {
    rows.push(['評価結果', '評価不能(入力エラー)'])
    rows.push(['field', 'code', 'message'])
    for (const issue of evaluation.errors) rows.push([issue.field, issue.code, issue.message])
    return rows
  }

  rows.push(['EVレンジ(百万円)'])
  rows.push(['悲観', 'ベース', '楽観'])
  rows.push([evaluation.value.ev.pessimistic, evaluation.value.ev.base, evaluation.value.ev.optimistic])
  rows.push([])

  if (evaluation.value.auxiliary !== undefined) {
    rows.push(['簡易DCF(補助評価、百万円)', evaluation.value.auxiliary])
    rows.push([])
  }

  const keyMetricsTable = KEY_METRICS_LABELS[scenario.sector]
  if (Object.keys(keyMetricsTable).length > 0) {
    rows.push(['keyMetrics'])
    rows.push(['指標', '値', '単位'])
    for (const [key, { label, format }] of Object.entries(keyMetricsTable)) {
      const raw = evaluation.value.keyMetrics[key]
      if (typeof raw !== 'number') continue
      const value = format === 'ratio' ? raw * 100 : raw
      const unit = format === 'pt' ? 'pt' : format === 'x' ? 'x' : format === 'months' ? '月' : format === 'years' ? '年' : format === 'yen' ? '円' : '%'
      rows.push([label, value, unit])
    }
    rows.push([])
  }

  rows.push(['VC法: 入力'])
  rows.push(['目標倍率(x)', scenario.vcMethod.targetMultiple])
  rows.push(['Exitまでの年数', scenario.vcMethod.yearsToExit])
  rows.push(['投資額(百万円)', scenario.vcMethod.investment])
  rows.push(['Exit時持分残存率(%)', scenario.vcMethod.dilutionRetention * 100])
  rows.push(['Exit時純有利子負債(百万円)', scenario.vcMethod.netDebtAtExit])
  rows.push([])

  const vcResults: Record<(typeof RANGE_KEYS)[number], VcMethodResult> = {
    pessimistic: computeVcMethod({
      exitEnterpriseValue: evaluation.value.ev.pessimistic,
      netDebtAtExit: scenario.vcMethod.netDebtAtExit,
      targetMultiple: scenario.vcMethod.targetMultiple,
      yearsToExit: scenario.vcMethod.yearsToExit,
      investment: scenario.vcMethod.investment,
      dilutionRetention: scenario.vcMethod.dilutionRetention,
    }),
    base: computeVcMethod({
      exitEnterpriseValue: evaluation.value.ev.base,
      netDebtAtExit: scenario.vcMethod.netDebtAtExit,
      targetMultiple: scenario.vcMethod.targetMultiple,
      yearsToExit: scenario.vcMethod.yearsToExit,
      investment: scenario.vcMethod.investment,
      dilutionRetention: scenario.vcMethod.dilutionRetention,
    }),
    optimistic: computeVcMethod({
      exitEnterpriseValue: evaluation.value.ev.optimistic,
      netDebtAtExit: scenario.vcMethod.netDebtAtExit,
      targetMultiple: scenario.vcMethod.targetMultiple,
      yearsToExit: scenario.vcMethod.yearsToExit,
      investment: scenario.vcMethod.investment,
      dilutionRetention: scenario.vcMethod.dilutionRetention,
    }),
  }
  rows.push(['VC法: 出力', '悲観', 'ベース', '楽観'])
  rows.push(['Exit株式価値(百万円)', ...RANGE_KEYS.map((k) => vcResults[k].exitEquityValue)])
  rows.push(['現在の許容ポストマネー(百万円)', ...RANGE_KEYS.map((k) => vcResults[k].impliedPostMoneyNow)])
  rows.push(['Exit時必要持分(%)', ...RANGE_KEYS.map((k) => vcResults[k].requiredOwnershipAtExit * 100)])
  rows.push(['投資時必要持分(%)', ...RANGE_KEYS.map((k) => vcResults[k].requiredOwnershipAtEntry * 100)])
  rows.push(['含意IRR(%)', vcResults.base.impliedIrr * 100])
  rows.push([])

  // 資本政策: 期待IRR/MOIC・ラウンド表・持分推移(P5-8採用)。CapitalPolicySectionと同じガード。
  rows.push(['資本政策: 期待IRR/MOIC'])
  const equityValue = evaluation.value.ev[scenario.capitalPolicy.exitEvSource] - scenario.vcMethod.netDebtAtExit
  const dilutionInputs: DilutionInputs = {
    initialCapTable: scenario.capitalPolicy.initialCapTable,
    rounds: scenario.capitalPolicy.rounds,
    exit: { yearIndex: scenario.vcMethod.yearsToExit, equityValue },
  }
  const issues = equityValue > 0 ? validateDilutionInputs(dilutionInputs) : []
  const dilutionResult = equityValue > 0 && issues.length === 0 ? simulateDilution(dilutionInputs) : null
  if (equityValue <= 0) {
    rows.push(['期待IRR/MOIC', '—(Exit株式価値が0以下)'])
  } else if (issues.length > 0) {
    rows.push(['期待IRR/MOIC', '—(資本政策の入力エラー)'])
  } else if (dilutionResult) {
    rows.push(['期待IRR(%)', dilutionResult.fundIrr !== null ? dilutionResult.fundIrr * 100 : '—(自ファンドの出資がありません)'])
    rows.push(['期待MOIC(x)', dilutionResult.fundMoic !== null ? dilutionResult.fundMoic : '—(自ファンドの出資がありません)'])
  }
  rows.push([])

  rows.push(['資本政策: ラウンド表'])
  rows.push(['ラウンド名', '年', 'プレバリュー(百万円)', '調達額(百万円)', 'プール目標(%)', '自ファンド出資額(百万円)'])
  for (const r of scenario.capitalPolicy.rounds) {
    rows.push([r.name, r.yearIndex, r.preMoneyValuation, r.amountRaised, r.optionPoolPostPct * 100, r.fundInvestment])
  }
  rows.push([])

  if (dilutionResult) {
    rows.push(['資本政策: 持分推移'])
    const matrix = buildOwnershipMatrix(scenario.capitalPolicy.initialCapTable, dilutionResult.rounds)
    rows.push(['保有者', '初期', ...scenario.capitalPolicy.rounds.map((r) => `${r.name}後`)])
    for (const holderRow of matrix) {
      rows.push([holderRow.name, ...holderRow.values.map((v) => (v === null ? '' : v * 100))])
    }
    rows.push([])
  }

  rows.push(['感度分析(上位10件、span降順)'])
  rows.push(['ドライバー', '低位EV(百万円)', '高位EV(百万円)', '変動幅(百万円)', '変動幅δ(%)'])
  const { rows: tornadoRows } = buildTornadoRows(scenario, { defaultDelta: 0.2 })
  for (const t of tornadoRows.slice(0, SENSITIVITY_TOP_N)) {
    rows.push([t.label, t.evAtLow, t.evAtHigh, t.span, t.delta * 100])
  }

  return rows
}

export function buildScenarioWorkbook(scenario: Scenario, benchmarkDataStatus: DataStatus | 'unknown'): WorkBook {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(buildResultsSheetRows(scenario)), '結果')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(buildAssumptionsSheetRows(scenario, benchmarkDataStatus)), '前提条件')
  return workbook
}
