/**
 * WorkBookをブラウザにダウンロードさせる薄いラッパー。出典: docs/phase5-spec.md §4.1
 * downloadJsonFile.ts と同型。生成はすべてブラウザ内(外部送信なし、設計原則4)。
 */
import * as XLSX from 'xlsx'
import type { WorkBook } from 'xlsx'

export function downloadXlsxFile(filename: string, workbook: WorkBook): void {
  const data = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
