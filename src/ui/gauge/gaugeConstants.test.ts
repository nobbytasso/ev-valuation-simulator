import { describe, expect, it } from 'vitest'
import { normalizeRatio } from './gaugeConstants.ts'

describe('normalizeRatio', () => {
  it('0〜maxの範囲は線形に[0,1]へ写像する', () => {
    expect(normalizeRatio(0, 80)).toBe(0)
    expect(normalizeRatio(40, 80)).toBe(0.5)
    expect(normalizeRatio(80, 80)).toBe(1)
  })
  it('maxを超える値は1にクランプする', () => {
    expect(normalizeRatio(100, 80)).toBe(1)
  })
  it('負値は0にクランプする', () => {
    expect(normalizeRatio(-10, 80)).toBe(0)
  })
})
