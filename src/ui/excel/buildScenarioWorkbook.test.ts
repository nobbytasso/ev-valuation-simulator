import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { evaluateSaas } from '../../engine/index.ts'
import { createScenario } from '../../store/defaultInputs.ts'
import { SECTOR_IDS } from '../../store/scenarioTypes.ts'
import type { Scenario } from '../../store/scenarioTypes.ts'
import { FIELD_LABEL_TABLES } from '../scenarioEvaluation/fieldLabelTables.ts'
import { buildScenarioWorkbook } from './buildScenarioWorkbook.ts'

type Row = (string | number)[]

/** XLSX.write→XLSX.readの往復で読み戻し、シート名ごとの行配列を返す(§4.1のテスト方針)。 */
function readBack(scenario: Scenario, benchmarkDataStatus: 'dummy' | 'production' | 'unknown' = 'dummy') {
  const workbook = buildScenarioWorkbook(scenario, benchmarkDataStatus)
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  const reloaded = XLSX.read(buffer, { type: 'array' })
  const sheetNames = reloaded.SheetNames
  const rowsBySheet = new Map<string, Row[]>()
  for (const name of sheetNames) {
    rowsBySheet.set(name, XLSX.utils.sheet_to_json<Row>(reloaded.Sheets[name], { header: 1 }))
  }
  return { sheetNames, rowsBySheet }
}

function findRowIndex(rows: Row[], predicate: (row: Row) => boolean): number {
  return rows.findIndex(predicate)
}

describe('buildScenarioWorkbook', () => {
  it.each(SECTOR_IDS)('%s: 「結果」「前提条件」の2シートを持つワークブックを構築できる', (sectorId) => {
    const scenario = createScenario(sectorId, 'テストシナリオ')
    const { sheetNames } = readBack(scenario)
    expect(sheetNames).toEqual(['結果', '前提条件'])
  })

  it.each(SECTOR_IDS)('%s: 前提条件シートのスカラー入力行数がフィールドラベル表と一致する', (sectorId) => {
    const scenario = createScenario(sectorId, 'テストシナリオ')
    const { rowsBySheet } = readBack(scenario)
    const rows = rowsBySheet.get('前提条件') as Row[]
    const headerIdx = findRowIndex(rows, (r) => r[0] === '項目' && r[1] === '値')
    expect(headerIdx).toBeGreaterThanOrEqual(0)
    const scalarCount = Object.keys(FIELD_LABEL_TABLES[sectorId].scalars).length
    for (let i = 1; i <= scalarCount; i++) {
      expect(rows[headerIdx + i]).toBeDefined()
    }
  })

  it('SaaS: EVレンジ・auxiliary・keyMetrics・VC法出力が数値セルとして出力される(検収条件)', () => {
    const scenario = createScenario('saas_jp', 'SaaSテスト') as Extract<Scenario, { sector: 'saas_jp' }>
    const expected = evaluateSaas(scenario.inputs)
    expect(expected.ok).toBe(true)
    if (!expected.ok) return

    const { rowsBySheet } = readBack(scenario)
    const rows = rowsBySheet.get('結果') as Row[]

    const evHeaderIdx = findRowIndex(rows, (r) => r[0] === '悲観' && r[1] === 'ベース' && r[2] === '楽観')
    const evValueRow = rows[evHeaderIdx + 1]
    expect(typeof evValueRow[0]).toBe('number')
    expect(evValueRow[0]).toBeCloseTo(expected.value.ev.pessimistic, 6)
    expect(evValueRow[1]).toBeCloseTo(expected.value.ev.base, 6)
    expect(evValueRow[2]).toBeCloseTo(expected.value.ev.optimistic, 6)

    const auxRowIdx = findRowIndex(rows, (r) => typeof r[0] === 'string' && r[0].startsWith('簡易DCF'))
    expect(auxRowIdx).toBeGreaterThanOrEqual(0)
    expect(typeof rows[auxRowIdx][1]).toBe('number')

    const ruleOf40Idx = findRowIndex(rows, (r) => r[0] === 'Rule of 40')
    expect(ruleOf40Idx).toBeGreaterThanOrEqual(0)
    expect(typeof rows[ruleOf40Idx][1]).toBe('number')

    const vcOutputIdx = findRowIndex(rows, (r) => r[0] === 'VC法: 出力')
    expect(vcOutputIdx).toBeGreaterThanOrEqual(0)
    const impliedIrrIdx = findRowIndex(rows, (r) => r[0] === '含意IRR(%)')
    expect(typeof rows[impliedIrrIdx][1]).toBe('number')
  })

  it('資本政策: ラウンド未登録(自ファンド出資なし)では期待IRR/MOICが「—」注記になる', () => {
    const scenario = createScenario('saas_jp', 'SaaSテスト')
    const { rowsBySheet } = readBack(scenario)
    const rows = rowsBySheet.get('結果') as Row[]
    const idx = findRowIndex(rows, (r) => typeof r[0] === 'string' && r[0].startsWith('期待IRR'))
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(rows[idx][1]).toBe('—(自ファンドの出資がありません)')
  })

  it('評価不能(ok:false)なシナリオでもクラッシュせず「結果」シートにエラー内容を出力する', () => {
    const scenario = createScenario('saas_jp', '不正シナリオ') as Extract<Scenario, { sector: 'saas_jp' }>
    scenario.inputs.discountRate = 0.01
    scenario.inputs.terminalGrowth = 0.02 // r <= terminalGrowth はValidationIssue

    const { rowsBySheet } = readBack(scenario)
    const rows = rowsBySheet.get('結果') as Row[]
    const errorRowIdx = findRowIndex(rows, (r) => r[0] === '評価結果')
    expect(errorRowIdx).toBeGreaterThanOrEqual(0)
    expect(rows[errorRowIdx]).toEqual(['評価結果', '評価不能(入力エラー)'])
    expect(rows.length).toBeGreaterThan(errorRowIdx + 1)
    // 前提条件シートは評価とは独立に構築される
    expect((rowsBySheet.get('前提条件') as Row[]).length).toBeGreaterThan(0)
  })

  it('創薬: 前提条件シートに品目ブロック(assetBlock)がフェーズ別ラベル付きで展開される', () => {
    const scenario = createScenario('drug_discovery', '創薬テスト')
    const { rowsBySheet } = readBack(scenario)
    const rows = rowsBySheet.get('前提条件') as Row[]
    const headingIdx = findRowIndex(rows, (r) => typeof r[0] === 'string' && r[0].startsWith('品目1:'))
    expect(headingIdx).toBeGreaterThanOrEqual(0)
    const phaseRowIdx = findRowIndex(rows, (r) => r[0] === '成功確率(フェーズ1)')
    expect(phaseRowIdx).toBeGreaterThan(headingIdx)
    expect(typeof rows[phaseRowIdx][1]).toBe('number')

    // 感度分析は上位10行以内(§4.2 P5-8)
    const resultRows = rowsBySheet.get('結果') as Row[]
    const sensitivityHeaderIdx = findRowIndex(resultRows, (r) => r[0] === 'ドライバー')
    expect(sensitivityHeaderIdx).toBeGreaterThanOrEqual(0)
    const sensitivityDataRows = resultRows.slice(sensitivityHeaderIdx + 1)
    expect(sensitivityDataRows.length).toBeLessThanOrEqual(10)
  })

  it('クライメート: 前提条件シートにcapexSchedule[]が年・金額の2列表として展開される', () => {
    const scenario = createScenario('climate_tech', 'クライメートテスト')
    const { rowsBySheet } = readBack(scenario)
    const rows = rowsBySheet.get('前提条件') as Row[]
    const headerIdx = findRowIndex(rows, (r) => typeof r[0] === 'string' && r[0].startsWith('年(') && typeof r[1] === 'string' && r[1].startsWith('金額'))
    expect(headerIdx).toBeGreaterThanOrEqual(0)
    const dataRow = rows[headerIdx + 1]
    expect(typeof dataRow[0]).toBe('number')
    expect(typeof dataRow[1]).toBe('number')
  })

  it('ベンチマークデータの状態(dummy/production/unknown)が前提条件シートに明記される', () => {
    const scenario = createScenario('saas_jp', 'SaaSテスト')
    const dummy = readBack(scenario, 'dummy')
    const production = readBack(scenario, 'production')
    const unknown = readBack(scenario, 'unknown')
    const findStatus = (rows: Row[]) => rows.find((r) => r[0] === 'ベンチマークデータの状態')?.[1]
    expect(findStatus(dummy.rowsBySheet.get('前提条件') as Row[])).toBe('ダミーデータ(実データではない)')
    expect(findStatus(production.rowsBySheet.get('前提条件') as Row[])).toBe('実データ')
    expect(findStatus(unknown.rowsBySheet.get('前提条件') as Row[])).toBe('不明(未取得)')
  })
})
