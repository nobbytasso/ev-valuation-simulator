import { describe, expect, it } from 'vitest'
import {
  evaluateClimateTech,
  evaluateDrugDiscovery,
  evaluateEcD2c,
  evaluateMediaTech,
  evaluateMedicalDevice,
  evaluateSaas,
} from '../../engine/index.ts'
import { createScenario } from '../../store/defaultInputs.ts'
import { SECTOR_IDS } from '../../store/scenarioTypes.ts'
import { evaluateScenario } from './evaluateScenario.ts'

describe('evaluateScenario', () => {
  it.each(SECTOR_IDS)('%s: 個別の evaluateX と同値の結果を返す', (sectorId) => {
    const scenario = createScenario(sectorId, 'テストシナリオ')
    const viaFacade = evaluateScenario(scenario)

    const viaDirect =
      scenario.sector === 'saas_jp'
        ? evaluateSaas(scenario.inputs)
        : scenario.sector === 'drug_discovery'
          ? evaluateDrugDiscovery(scenario.inputs)
          : scenario.sector === 'medical_device'
            ? evaluateMedicalDevice(scenario.inputs)
            : scenario.sector === 'media_tech'
              ? evaluateMediaTech(scenario.inputs)
              : scenario.sector === 'ec_d2c'
                ? evaluateEcD2c(scenario.inputs)
                : evaluateClimateTech(scenario.inputs)

    expect(viaFacade).toEqual(viaDirect)
  })
})
