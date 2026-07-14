import { describe, expect, it } from 'vitest'
import type { ClimateTechInputs, DrugDiscoveryInputs } from '../../engine/index.ts'
import { createScenario } from '../../store/defaultInputs.ts'
import { SECTOR_IDS } from '../../store/scenarioTypes.ts'
import type { SectorId } from '../../store/scenarioTypes.ts'
import { CLIMATE_TECH_FIELD_LABELS } from '../sectors/climateTech/climateTechFieldLabels.ts'
import { DRUG_DISCOVERY_FIELD_LABELS } from '../sectors/drugDiscovery/drugDiscoveryFieldLabels.ts'
import { EC_D2C_FIELD_LABELS } from '../sectors/ecD2c/ecD2cFieldLabels.ts'
import { MEDIA_TECH_FIELD_LABELS } from '../sectors/mediaTech/mediaTechFieldLabels.ts'
import { MEDICAL_DEVICE_FIELD_LABELS } from '../sectors/medicalDevice/medicalDeviceFieldLabels.ts'
import { SAAS_FIELD_LABELS } from '../sectors/saas/saasFieldLabels.ts'
import type { SectorFieldLabelTable } from './fieldLabelTypes.ts'

const TABLES: Record<SectorId, SectorFieldLabelTable> = {
  saas_jp: SAAS_FIELD_LABELS,
  drug_discovery: DRUG_DISCOVERY_FIELD_LABELS,
  medical_device: MEDICAL_DEVICE_FIELD_LABELS,
  media_tech: MEDIA_TECH_FIELD_LABELS,
  ec_d2c: EC_D2C_FIELD_LABELS,
  climate_tech: CLIMATE_TECH_FIELD_LABELS,
}

/** obj の各トップレベルキーが scalarKeys(ドット区切りprefix含む)または arrayKeys に含まれるかを判定し、未網羅キーを返す。 */
function uncoveredKeys(obj: Record<string, unknown>, scalarKeys: string[], arrayKeys: string[]): string[] {
  return Object.keys(obj).filter((key) => {
    if (arrayKeys.includes(key)) return false
    if (scalarKeys.includes(key)) return false
    return !scalarKeys.some((k) => k.startsWith(`${key}.`))
  })
}

describe('セクター別フィールドラベル表: inputsの全キーを網羅する', () => {
  it.each(SECTOR_IDS)('%s', (sectorId) => {
    const scenario = createScenario(sectorId, 'テストシナリオ')
    const table = TABLES[sectorId]
    const missing = uncoveredKeys(
      scenario.inputs as unknown as Record<string, unknown>,
      Object.keys(table.scalars),
      Object.keys(table.arrays),
    )
    expect(missing).toEqual([])
  })

  it('創薬 assets[] の品目内フィールドが PipelineAsset の全キーを網羅する', () => {
    const scenario = createScenario('drug_discovery', 'テストシナリオ')
    const asset = (scenario.inputs as DrugDiscoveryInputs).assets[0]
    const itemFields = DRUG_DISCOVERY_FIELD_LABELS.arrays.assets.itemFields
    const missing = uncoveredKeys(asset as unknown as Record<string, unknown>, Object.keys(itemFields), [])
    expect(missing).toEqual([])
  })

  it('クライメート capexSchedule[] の行内フィールドが全キーを網羅する', () => {
    const scenario = createScenario('climate_tech', 'テストシナリオ')
    const row = (scenario.inputs as ClimateTechInputs).capexSchedule[0]
    const itemFields = CLIMATE_TECH_FIELD_LABELS.arrays.capexSchedule.itemFields
    const missing = uncoveredKeys(row as unknown as Record<string, unknown>, Object.keys(itemFields), [])
    expect(missing).toEqual([])
  })
})
