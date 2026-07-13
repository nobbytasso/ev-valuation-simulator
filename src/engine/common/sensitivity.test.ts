import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { buildTornado } from './sensitivity.ts'

interface FakeInputs {
  a: number
  b: number
  c: number
}

function applyDriver(inputs: FakeInputs, driverId: string, multiplier: number): FakeInputs {
  return { ...inputs, [driverId]: (inputs as unknown as Record<string, number>)[driverId] * multiplier }
}

function evaluate(inputs: FakeInputs): number {
  return inputs.a * 2 + inputs.b * 3 - inputs.c
}

describe('buildTornado', () => {
  it('P14: delta = 0 のとき全 TornadoItem の span = 0', () => {
    fc.assert(
      fc.property(
        fc.record({
          a: fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
          b: fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
          c: fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
        }),
        (base) => {
          const items = buildTornado(base, { delta: 0, driverIds: ['a', 'b', 'c'] }, applyDriver, evaluate)
          for (const item of items) {
            expect(item.span).toBeCloseTo(0, 9)
          }
        },
      ),
    )
  })

  it('span 降順にソートされる', () => {
    const base: FakeInputs = { a: 100, b: 10, c: 1 }
    const items = buildTornado(base, { delta: 0.2, driverIds: ['a', 'b', 'c'] }, applyDriver, evaluate)
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].span).toBeGreaterThanOrEqual(items[i].span)
    }
  })

  it('one-at-a-time: 他のドライバーはベース値に固定される', () => {
    const base: FakeInputs = { a: 10, b: 20, c: 30 }
    const items = buildTornado(base, { delta: 0.5, driverIds: ['a'] }, applyDriver, evaluate)
    // aのみ変動: evAtLow = (a*0.5)*2+b*3-c, evAtHigh = (a*1.5)*2+b*3-c
    expect(items[0].evAtLow).toBeCloseTo(10 * 0.5 * 2 + 20 * 3 - 30, 9)
    expect(items[0].evAtHigh).toBeCloseTo(10 * 1.5 * 2 + 20 * 3 - 30, 9)
  })

  it('evAtHigh < evAtLow となるドライバーもそのまま返す(符号反転はUI側の責務)', () => {
    const base: FakeInputs = { a: 10, b: 10, c: 100 }
    // c は evaluate 内で減算されるため、cが増えるとEVは下がる
    const items = buildTornado(base, { delta: 0.5, driverIds: ['c'] }, applyDriver, evaluate)
    expect(items[0].evAtHigh).toBeLessThan(items[0].evAtLow)
    expect(items[0].span).toBeCloseTo(Math.abs(items[0].evAtHigh - items[0].evAtLow), 9)
  })
})
