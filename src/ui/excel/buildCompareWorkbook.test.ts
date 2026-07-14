import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { createScenario } from '../../store/defaultInputs.ts'
import { buildCompareColumns } from '../compare/compareEngine.ts'
import { buildCompareWorkbook } from './buildCompareWorkbook.ts'

type Row = (string | number)[]

function readBack(workbook: ReturnType<typeof buildCompareWorkbook>) {
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

describe('buildCompareWorkbook', () => {
  it('「比較」「前提条件」の2シートを持つワークブックを構築できる', () => {
    const saasA = createScenario('saas_jp', 'SaaS-A')
    const columns = buildCompareColumns([saasA.id], [saasA])
    const { sheetNames } = readBack(buildCompareWorkbook(columns))
    expect(sheetNames).toEqual(['比較', '前提条件'])
  })

  it('見出し行に列(シナリオ名)が並び、不明idは「見つかりません」になる', () => {
    const saasA = createScenario('saas_jp', 'SaaS-A')
    const columns = buildCompareColumns(['unknown-id', saasA.id], [saasA])
    const { rowsBySheet } = readBack(buildCompareWorkbook(columns))
    const rows = rowsBySheet.get('比較') as Row[]
    expect(rows[0]).toEqual(['指標', '見つかりません', 'SaaS-A'])
  })

  it('EVレンジは数値セルとして出力される(検収条件)', () => {
    const saasA = createScenario('saas_jp', 'SaaS-A')
    const columns = buildCompareColumns([saasA.id], [saasA])
    const { rowsBySheet } = readBack(buildCompareWorkbook(columns))
    const rows = rowsBySheet.get('比較') as Row[]
    const idx = findRowIndex(rows, (r) => typeof r[0] === 'string' && r[0].startsWith('EV(ベース'))
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(typeof rows[idx][1]).toBe('number')
  })

  it('同一セクターが2件以上のときのみセクター別ブロックの見出しが現れる', () => {
    const saasA = createScenario('saas_jp', 'SaaS-A')
    const saasB = createScenario('saas_jp', 'SaaS-B')
    const media = createScenario('media_tech', 'Media-A')

    const mixedColumns = buildCompareColumns([saasA.id, media.id], [saasA, media])
    const { rowsBySheet: mixedRows } = readBack(buildCompareWorkbook(mixedColumns))
    expect(findRowIndex(mixedRows.get('比較') as Row[], (r) => r[0] === 'SaaS(日本)別指標')).toBe(-1)

    const pairedColumns = buildCompareColumns([saasA.id, saasB.id, media.id], [saasA, saasB, media])
    const { rowsBySheet: pairedRows } = readBack(buildCompareWorkbook(pairedColumns))
    expect(findRowIndex(pairedRows.get('比較') as Row[], (r) => r[0] === 'SaaS(日本)別指標')).toBeGreaterThanOrEqual(0)
  })

  it('前提条件シートはシナリオ毎の展開をセクター見出し付きで縦連結する', () => {
    const saasA = createScenario('saas_jp', 'SaaS-A')
    const media = createScenario('media_tech', 'Media-A')
    const columns = buildCompareColumns([saasA.id, media.id], [saasA, media])
    const { rowsBySheet } = readBack(buildCompareWorkbook(columns, { saas_jp: 'dummy', media_tech: 'production' }))
    const rows = rowsBySheet.get('前提条件') as Row[]
    const saasHeadingIdx = findRowIndex(rows, (r) => r[0] === '■ SaaS(日本): SaaS-A')
    const mediaHeadingIdx = findRowIndex(rows, (r) => r[0] === '■ メディアテック: Media-A')
    expect(saasHeadingIdx).toBeGreaterThanOrEqual(0)
    expect(mediaHeadingIdx).toBeGreaterThan(saasHeadingIdx)
    const dummyStatusIdx = findRowIndex(rows, (r) => r[1] === 'ダミーデータ(実データではない)')
    const productionStatusIdx = findRowIndex(rows, (r) => r[1] === '実データ')
    expect(dummyStatusIdx).toBeGreaterThan(saasHeadingIdx)
    expect(dummyStatusIdx).toBeLessThan(mediaHeadingIdx)
    expect(productionStatusIdx).toBeGreaterThan(mediaHeadingIdx)
  })
})
