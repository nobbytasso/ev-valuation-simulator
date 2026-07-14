/**
 * 金額表示フォーマッタ(純粋関数)。出典: docs/phase6-spec.md §3、P6-1/P6-2裁定。
 * 6ファイルに重複していたformatMoneyをここに一本化する。
 * 値は常に百万円建てで受け取り(エンジン・永続化の単位。P6-1)、表示直前にのみ単位変換する。
 */
export type MoneyUnit = 'million_yen' | 'oku_yen'

const MILLION_YEN_PER_OKU_YEN = 100

export function moneyUnitLabel(unit: MoneyUnit): string {
  return unit === 'oku_yen' ? '億円' : '百万円'
}

/** 表ヘッダ・チャート軸ラベル用。例: 「企業価値(百万円)」の括弧内。 */
export function moneyAxisLabel(unit: MoneyUnit): string {
  return `(${moneyUnitLabel(unit)})`
}

export function moneyValueInUnit(valueInMillionYen: number, unit: MoneyUnit): number {
  return unit === 'oku_yen' ? valueInMillionYen / MILLION_YEN_PER_OKU_YEN : valueInMillionYen
}

/** 単位なしの数値文字列(桁区切りのみ)。億円は小数1桁固定(P6-2)、百万円は整数。 */
export function formatMoneyValue(valueInMillionYen: number, unit: MoneyUnit): string {
  const converted = moneyValueInUnit(valueInMillionYen, unit)
  const fractionDigits = unit === 'oku_yen' ? 1 : 0
  return converted.toLocaleString('ja-JP', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

/** 単位付きの完全な表示文字列。算出不能値(null/undefined)は「—」。 */
export function formatMoney(valueInMillionYen: number | null | undefined, unit: MoneyUnit): string {
  if (valueInMillionYen === null || valueInMillionYen === undefined) return '—'
  return `${formatMoneyValue(valueInMillionYen, unit)} ${moneyUnitLabel(unit)}`
}
