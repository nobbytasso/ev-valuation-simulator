/**
 * InvestmentWorkbenchPage の動的フィールド(FieldDefinition)表示値・保存値の相互変換。
 * 出典: docs/v2-adoption-spec.md §5 A(%入力の浮動小数点修正)。
 *
 * `format: 'percent'` の全フィールド(ピーク売上想定の年次変化率・Exit時持分残存率・
 * Exit時点の上市成功確率・売上価値の自社帰属率 等)がこの1関数を通ることで、
 * 0.07 → 7.000000000000001 のような浮動小数点アーティファクトを共通ヘルパー
 * `ratioToPercentInput`(src/ui/format/percent.ts、Phase 6実装)経由で排除する。
 */
import type { FieldDefinition } from '../domain/types.ts'
import { ratioToPercentInput } from '../../ui/format/percent.ts'

/** 内部の比率(0.07)を、%入力欄に渡す表示値(7)へ変換する。 */
export function displayedValue(value: number | string | undefined, field: FieldDefinition): number | string {
  if (value === undefined) return ''
  if (typeof value === 'string') return value
  return field.format === 'percent' ? ratioToPercentInput(value) : value
}

/** %入力欄の生文字列("7")を、内部の比率(0.07)へ変換する。 */
export function storedValue(raw: string, field: FieldDefinition): number | string {
  if (field.kind === 'select') return raw
  const value = Number(raw)
  return field.format === 'percent' ? value / 100 : value
}
