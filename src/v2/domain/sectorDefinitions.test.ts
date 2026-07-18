import { describe, expect, it } from 'vitest'
import { createDefaultWorkbench, getSectorDefinition } from './sectorDefinitions.ts'
import { V2_SECTOR_IDS } from './types.ts'

describe('v2 sector definitions', () => {
  it.each(V2_SECTOR_IDS)('%s produces four finite case results', (sector) => {
    const state = createDefaultWorkbench(sector)
    const definition = getSectorDefinition(sector)
    const results = state.cases.map((investmentCase) => definition.evaluate(state.company, investmentCase))
    expect(results).toHaveLength(4)
    for (const result of results) {
      expect(Number.isFinite(result.exitEnterpriseValue)).toBe(true)
      expect(Number.isFinite(result.currentAllowablePostMoney)).toBe(true)
      expect(Number.isFinite(result.impliedTargetIrr)).toBe(true)
    }
  })

  it('SaaS management case is worth more than severe downside by default', () => {
    const state = createDefaultWorkbench('saas_jp')
    const definition = getSectorDefinition('saas_jp')
    const management = definition.evaluate(state.company, state.cases[0])
    const severe = definition.evaluate(state.company, state.cases[3])
    expect(management.exitEnterpriseValue).toBeGreaterThan(severe.exitEnterpriseValue)
  })
})
