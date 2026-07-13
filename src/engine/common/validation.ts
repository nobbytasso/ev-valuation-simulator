/**
 * ドメイン検証の共通ヘルパー。出典: docs/engine-spec.md §0.2, §0.2.1
 *
 * 全セクターの evaluate*() 関数は、ドメイン外入力を発見した時点で打ち切らず、
 * 該当する違反を全件収集してから ok:false を返す(§0.2.1「複数違反は全件列挙」)。
 * 依存ゼロの純粋関数のみ。
 */
import type { ValidationIssue } from '../types.ts'

/** value が [min, max](既定は両端含む)の範囲内か検証する。 */
export function inRange(
  value: number,
  field: string,
  min: number,
  max: number,
  opts: { minExclusive?: boolean; maxExclusive?: boolean } = {},
): ValidationIssue | null {
  const { minExclusive = false, maxExclusive = false } = opts
  const lowOk = minExclusive ? value > min : value >= min
  const highOk = maxExclusive ? value < max : value <= max
  if (lowOk && highOk) return null
  const lb = minExclusive ? '(' : '['
  const rb = maxExclusive ? ')' : ']'
  return {
    field,
    code: 'OUT_OF_DOMAIN',
    message: `${field} は ${lb}${min}, ${max}${rb} の範囲である必要があります(実際: ${value})`,
  }
}

/** value が min 以上(既定)、または min 超(exclusive)か検証する。上限なし。 */
export function atLeast(
  value: number,
  field: string,
  min: number,
  opts: { exclusive?: boolean } = {},
): ValidationIssue | null {
  const { exclusive = false } = opts
  const ok = exclusive ? value > min : value >= min
  if (ok) return null
  return {
    field,
    code: 'OUT_OF_DOMAIN',
    message: `${field} は ${min} ${exclusive ? 'を超える' : '以上の'}値である必要があります(実際: ${value})`,
  }
}

/** value が1以上の整数か検証する(年数・期間フィールド用)。 */
export function positiveInteger(value: number, field: string): ValidationIssue | null {
  if (Number.isInteger(value) && value >= 1) return null
  return {
    field,
    code: 'OUT_OF_DOMAIN',
    message: `${field} は1以上の整数である必要があります(実際: ${value})`,
  }
}

/** 0以上の整数か検証する(plateauYears・approvalDelayYears等、0を許容する期間用)。 */
export function nonNegativeInteger(value: number, field: string): ValidationIssue | null {
  if (Number.isInteger(value) && value >= 0) return null
  return {
    field,
    code: 'OUT_OF_DOMAIN',
    message: `${field} は0以上の整数である必要があります(実際: ${value})`,
  }
}

/** null でないチェック結果だけを集めて ValidationIssue[] にする。 */
export function collectIssues(...checks: (ValidationIssue | null)[]): ValidationIssue[] {
  return checks.filter((c): c is ValidationIssue => c !== null)
}
