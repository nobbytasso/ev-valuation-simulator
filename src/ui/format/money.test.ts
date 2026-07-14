import { describe, expect, it } from 'vitest'
import { formatMoney, formatMoneyValue, moneyAxisLabel, moneyUnitLabel, moneyValueInUnit } from './money.ts'

describe('moneyUnitLabel / moneyAxisLabel', () => {
  it('百万円/億円のラベルを返す', () => {
    expect(moneyUnitLabel('million_yen')).toBe('百万円')
    expect(moneyUnitLabel('oku_yen')).toBe('億円')
  })
  it('括弧付きの軸ラベルを返す', () => {
    expect(moneyAxisLabel('million_yen')).toBe('(百万円)')
    expect(moneyAxisLabel('oku_yen')).toBe('(億円)')
  })
})

describe('moneyValueInUnit', () => {
  it('百万円はそのまま', () => {
    expect(moneyValueInUnit(10400, 'million_yen')).toBe(10400)
  })
  it('億円は100で割る(100百万円=1億円)', () => {
    expect(moneyValueInUnit(100, 'oku_yen')).toBe(1)
    expect(moneyValueInUnit(10400, 'oku_yen')).toBe(104)
  })
})

describe('formatMoneyValue: 境界値(P6-2 億円は小数1桁)', () => {
  it('0', () => {
    expect(formatMoneyValue(0, 'million_yen')).toBe('0')
    expect(formatMoneyValue(0, 'oku_yen')).toBe('0.0')
  })
  it('負値', () => {
    expect(formatMoneyValue(-500, 'million_yen')).toBe('-500')
    expect(formatMoneyValue(-500, 'oku_yen')).toBe('-5.0')
  })
  it('100百万円 = 1.0億円', () => {
    expect(formatMoneyValue(100, 'oku_yen')).toBe('1.0')
  })
  it('1億円未満は小数で読める(0.5億円)', () => {
    expect(formatMoneyValue(50, 'oku_yen')).toBe('0.5')
  })
  it('丸め(10,400百万円 → 104.0億円)', () => {
    expect(formatMoneyValue(10400, 'oku_yen')).toBe('104.0')
  })
  it('丸め(桁区切り。1,234,567百万円)', () => {
    expect(formatMoneyValue(1234567, 'million_yen')).toBe('1,234,567')
  })
  it('小数第2位の四捨五入(123.45百万円 → 1.2億円)', () => {
    expect(formatMoneyValue(123.45, 'oku_yen')).toBe('1.2')
  })
})

describe('formatMoney: 単位付き完全表示', () => {
  it('null/undefinedは—', () => {
    expect(formatMoney(null, 'million_yen')).toBe('—')
    expect(formatMoney(undefined, 'oku_yen')).toBe('—')
  })
  it('百万円表示', () => {
    expect(formatMoney(10400, 'million_yen')).toBe('10,400 百万円')
  })
  it('億円表示', () => {
    expect(formatMoney(10400, 'oku_yen')).toBe('104.0 億円')
  })
})
