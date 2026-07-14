import { describe, expect, it } from 'vitest'
import { buildHoldingCashflows } from './buildHoldingCashflows.ts'

describe('buildHoldingCashflows', () => {
  it('t=0で投資額を負のCF、tで時価をプラスのCFとして返す(§3.3)', () => {
    const cashflows = buildHoldingCashflows(300, 450, 2.37)
    expect(cashflows).toEqual([
      { t: 0, cf: -300 },
      { t: 2.37, cf: 450 },
    ])
  })
})
