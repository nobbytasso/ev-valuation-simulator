/**
 * ベンチマーク値の単位フォーマット(純粋関数)。出典: docs/phase6-spec.md §7 D-14
 * BenchmarkBar.tsxから分離(コンポーネントファイルからの関数export はFast Refreshを妨げるため)。
 */
import type { BenchmarkUnit } from '../adapters/benchmarks/types.ts'

/** D-14: years→「年」、countは無単位(桁区切りのみ)。unitSuffix指定時は他の分岐に優先する。 */
export function formatValue(value: number, unit: BenchmarkUnit, unitSuffix?: string): string {
  if (unitSuffix !== undefined) return `${value.toLocaleString('ja-JP', { maximumFractionDigits: 2 })}${unitSuffix}`
  if (unit === 'percent') return `${value.toFixed(1)}%`
  if (unit === 'x_multiple') return `${value.toFixed(1)}x`
  if (unit === 'ratio') return value.toFixed(2)
  if (unit === 'jpy') return `${value.toLocaleString('ja-JP')}円`
  if (unit === 'years') return `${value.toLocaleString('ja-JP', { maximumFractionDigits: 1 })}年`
  if (unit === 'count') return value.toLocaleString('ja-JP')
  return value.toLocaleString('ja-JP')
}

export function formatDiff(diff: number, unit: BenchmarkUnit, unitSuffix?: string): string {
  const sign = diff >= 0 ? '+' : ''
  if (unitSuffix !== undefined) return `${sign}${diff.toLocaleString('ja-JP', { maximumFractionDigits: 2 })}${unitSuffix}`
  if (unit === 'percent') return `${sign}${diff.toFixed(1)}pt`
  if (unit === 'x_multiple') return `${sign}${diff.toFixed(1)}x`
  if (unit === 'ratio') return `${sign}${diff.toFixed(2)}`
  if (unit === 'jpy') return `${sign}${diff.toLocaleString('ja-JP')}円`
  if (unit === 'years') return `${sign}${diff.toLocaleString('ja-JP', { maximumFractionDigits: 1 })}年`
  if (unit === 'count') return `${sign}${diff.toLocaleString('ja-JP')}`
  return `${sign}${diff.toLocaleString('ja-JP')}`
}
