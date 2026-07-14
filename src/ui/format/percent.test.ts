import { describe, expect, it } from 'vitest'
import { ratioToPercentInput } from './percent.ts'

describe('ratioToPercentInput', () => {
  it('浮動小数点アーティファクトを丸める(デザインレビュー指摘の再現ケース)', () => {
    expect(ratioToPercentInput(0.07)).toBe(7) // 0.07 * 100 = 7.000000000000001
    expect(ratioToPercentInput(0.14)).toBe(14) // 0.14 * 100 = 14.000000000000002
    expect(ratioToPercentInput(0.7)).toBe(70) // 0.7 * 100 = 70.00000000000001
    expect(ratioToPercentInput(0.35)).toBe(35)
    expect(ratioToPercentInput(0.05)).toBe(5)
  })

  it('意図的な小数の精度は保つ(小数第6位まで)', () => {
    expect(ratioToPercentInput(0.125)).toBe(12.5)
    expect(ratioToPercentInput(0.0001)).toBe(0.01)
    expect(ratioToPercentInput(0.999)).toBe(99.9)
  })

  it('境界値', () => {
    expect(ratioToPercentInput(0)).toBe(0)
    expect(ratioToPercentInput(1)).toBe(100)
    expect(ratioToPercentInput(-0.1)).toBe(-10)
  })
})
