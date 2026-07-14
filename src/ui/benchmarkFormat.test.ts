import { describe, expect, it } from 'vitest'
import { formatDiff, formatValue } from './benchmarkFormat.ts'

describe('formatValue: D-14 単位サフィックス', () => {
  it('years は「年」を付す', () => {
    expect(formatValue(5, 'years')).toBe('5年')
    expect(formatValue(5.5, 'years')).toBe('5.5年')
  })
  it('count は無単位(桁区切りのみ)', () => {
    expect(formatValue(12000, 'count')).toBe('12,000')
  })
  it('unitSuffix指定時は他の分岐より優先される', () => {
    expect(formatValue(3, 'count', '件')).toBe('3件')
    expect(formatValue(0.5, 'percent', 'x')).toBe('0.5x')
  })
  it('既存の単位(percent/x_multiple/ratio/jpy)は従来どおり', () => {
    expect(formatValue(30, 'percent')).toBe('30.0%')
    expect(formatValue(8, 'x_multiple')).toBe('8.0x')
    expect(formatValue(0.25, 'ratio')).toBe('0.25')
    expect(formatValue(5000, 'jpy')).toBe('5,000円')
  })
})

describe('formatDiff: D-14 単位サフィックス', () => {
  it('years は符号+「年」', () => {
    expect(formatDiff(1.2, 'years')).toBe('+1.2年')
    expect(formatDiff(-1.2, 'years')).toBe('-1.2年')
  })
  it('count は符号+桁区切りのみ', () => {
    expect(formatDiff(500, 'count')).toBe('+500')
  })
  it('unitSuffix指定時は他の分岐より優先される', () => {
    expect(formatDiff(2, 'count', '件')).toBe('+2件')
  })
})
