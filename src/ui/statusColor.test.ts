import { describe, expect, it } from 'vitest'
import { benchmarkStatus } from './statusColor.ts'

describe('benchmarkStatus', () => {
  it('directionがneutralのときは常にneutral', () => {
    expect(benchmarkStatus(100, 50, 'neutral')).toBe('neutral')
    expect(benchmarkStatus(10, 50, 'neutral')).toBe('neutral')
  })

  it('industryStandard=0は相対差が定義できないためneutral', () => {
    expect(benchmarkStatus(5, 0, 'higher_better')).toBe('neutral')
  })

  it('±10%以内はcaution(higher_better)', () => {
    expect(benchmarkStatus(105, 100, 'higher_better')).toBe('caution')
    expect(benchmarkStatus(95, 100, 'higher_better')).toBe('caution')
    expect(benchmarkStatus(110, 100, 'higher_better')).toBe('caution') // 境界値ちょうど10%
  })

  it('higher_better: 10%超の好方向はgood、悪方向はbad', () => {
    expect(benchmarkStatus(120, 100, 'higher_better')).toBe('good')
    expect(benchmarkStatus(80, 100, 'higher_better')).toBe('bad')
  })

  it('lower_better: 好方向(下回る)はgood、悪方向(上回る)はbad', () => {
    expect(benchmarkStatus(80, 100, 'lower_better')).toBe('good')
    expect(benchmarkStatus(120, 100, 'lower_better')).toBe('bad')
    expect(benchmarkStatus(105, 100, 'lower_better')).toBe('caution')
  })

  it('industryStandardが負値でも相対差の絶対値を基準にする', () => {
    expect(benchmarkStatus(-80, -100, 'higher_better')).toBe('good') // -80は-100より大きい(良い)
    expect(benchmarkStatus(-120, -100, 'higher_better')).toBe('bad')
  })
})
