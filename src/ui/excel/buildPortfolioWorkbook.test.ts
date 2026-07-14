import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { createScenario } from '../../store/defaultInputs.ts'
import type { PortfolioHolding, Scenario } from '../../store/scenarioTypes.ts'
import { buildPortfolioWorkbook } from './buildPortfolioWorkbook.ts'

type Row = (string | number)[]

const EVAL_DATE = '2026-07-14T00:00:00.000Z'

function makeHolding(overrides: Partial<PortfolioHolding> = {}): PortfolioHolding {
  return {
    id: 'holding-1',
    companyName: 'テスト株式会社',
    sector: 'saas_jp',
    investmentAmount: 300,
    round: 'シリーズA',
    ownershipPct: 0.1,
    investmentDate: '2025-07-14',
    schemaVersion: 2,
    createdAt: EVAL_DATE,
    updatedAt: EVAL_DATE,
    ...overrides,
  }
}

function readBack(workbook: ReturnType<typeof buildPortfolioWorkbook>) {
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  const reloaded = XLSX.read(buffer, { type: 'array' })
  const rowsBySheet = new Map<string, Row[]>()
  for (const name of reloaded.SheetNames) {
    rowsBySheet.set(name, XLSX.utils.sheet_to_json<Row>(reloaded.Sheets[name], { header: 1 }))
  }
  return { sheetNames: reloaded.SheetNames, rowsBySheet }
}

function findRowIndex(rows: Row[], predicate: (row: Row) => boolean): number {
  return rows.findIndex(predicate)
}

describe('buildPortfolioWorkbook', () => {
  it('「サマリ」「前提条件」の2シートを持つワークブックを構築できる', () => {
    const holding = makeHolding()
    const { sheetNames } = readBack(buildPortfolioWorkbook([holding], new Map(), EVAL_DATE))
    expect(sheetNames).toEqual(['サマリ', '前提条件'])
  })

  it('紐付きシナリオの銘柄は時価3点が数値セルで出力され、評価方法は「シナリオ」になる', () => {
    const scenario = createScenario('saas_jp', 'OKシナリオ')
    const holding = makeHolding({ scenarioId: scenario.id })
    const scenarioById = new Map<string, Scenario>([[scenario.id, scenario]])

    const { rowsBySheet } = readBack(buildPortfolioWorkbook([holding], scenarioById, EVAL_DATE))
    const rows = rowsBySheet.get('サマリ') as Row[]
    const dataRow = rows[1]
    expect(dataRow[0]).toBe('テスト株式会社')
    expect(dataRow[5]).toBe('OKシナリオ')
    expect(typeof dataRow[6]).toBe('number') // 時価(悲観)
    expect(typeof dataRow[7]).toBe('number') // 時価(ベース)
    expect(typeof dataRow[8]).toBe('number') // 時価(楽観)
    expect(dataRow[11]).toBe('シナリオ')
  })

  it('未紐付けの銘柄はコスト評価(投資額そのまま)として出力される(P5-1裁定)', () => {
    const holding = makeHolding()
    const { rowsBySheet } = readBack(buildPortfolioWorkbook([holding], new Map(), EVAL_DATE))
    const rows = rowsBySheet.get('サマリ') as Row[]
    const dataRow = rows[1]
    expect(dataRow[6]).toBe(300)
    expect(dataRow[7]).toBe(300)
    expect(dataRow[8]).toBe(300)
    expect(dataRow[11]).toBe('コスト評価')
  })

  it('ファンド合計行が銘柄一覧の後に出力される', () => {
    const holdingA = makeHolding({ id: 'a', investmentAmount: 300 })
    const holdingB = makeHolding({ id: 'b', investmentAmount: 200, companyName: 'B社' })
    const { rowsBySheet } = readBack(buildPortfolioWorkbook([holdingA, holdingB], new Map(), EVAL_DATE))
    const rows = rowsBySheet.get('サマリ') as Row[]
    const totalRowIdx = findRowIndex(rows, (r) => r[0] === 'ファンド合計')
    expect(totalRowIdx).toBeGreaterThanOrEqual(0)
    expect(rows[totalRowIdx][3]).toBe(500) // 投資額合計
  })

  it('前提条件シートに評価基準日・コスト評価銘柄一覧・ベンチマーク状態が出力される', () => {
    const scenario = createScenario('saas_jp', 'OKシナリオ')
    const linkedHolding = makeHolding({ id: 'linked', scenarioId: scenario.id })
    const unlinkedHolding = makeHolding({ id: 'unlinked', companyName: 'コスト評価社' })
    const scenarioById = new Map<string, Scenario>([[scenario.id, scenario]])

    const { rowsBySheet } = readBack(
      buildPortfolioWorkbook([linkedHolding, unlinkedHolding], scenarioById, EVAL_DATE, { saas_jp: 'dummy' }),
    )
    const rows = rowsBySheet.get('前提条件') as Row[]

    expect(rows[0]).toEqual(['評価基準日', '2026-07-14'])

    const costListIdx = findRowIndex(rows, (r) => typeof r[0] === 'string' && r[0].startsWith('コスト評価銘柄一覧'))
    expect(costListIdx).toBeGreaterThanOrEqual(0)
    const costRowIdx = findRowIndex(rows, (r) => r[0] === 'コスト評価社' && r[1] === '未紐付け')
    expect(costRowIdx).toBeGreaterThan(costListIdx)

    const benchmarkIdx = findRowIndex(rows, (r) => r[0] === 'SaaS(日本)' && r[1] === 'ダミーデータ(実データではない)')
    expect(benchmarkIdx).toBeGreaterThanOrEqual(0)
  })

  it('シナリオ削除済み(scenarioIdは残るがscenarioById未登録)はコスト評価かつ理由が区別される', () => {
    const holding = makeHolding({ scenarioId: 'deleted-scenario-id' })
    const { rowsBySheet } = readBack(buildPortfolioWorkbook([holding], new Map(), EVAL_DATE))
    const summaryRows = rowsBySheet.get('サマリ') as Row[]
    expect(summaryRows[1][5]).toBe('(削除済み)')
    expect(summaryRows[1][11]).toBe('コスト評価')

    const assumptionRows = rowsBySheet.get('前提条件') as Row[]
    const reasonRowIdx = findRowIndex(assumptionRows, (r) => r[0] === 'テスト株式会社' && r[1] === 'シナリオ削除済み')
    expect(reasonRowIdx).toBeGreaterThanOrEqual(0)
  })
})
