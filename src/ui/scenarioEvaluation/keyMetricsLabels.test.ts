import { describe, expect, it } from 'vitest'
import { createScenario } from '../../store/defaultInputs.ts'
import { evaluateScenario } from './evaluateScenario.ts'
import { KEY_METRICS_LABELS } from './keyMetricsLabels.ts'

describe('KEY_METRICS_LABELS', () => {
  it.each(['saas_jp', 'media_tech', 'ec_d2c'] as const)(
    '%s: 登録済みキーはデフォルト入力の評価結果 keyMetrics に実在する',
    (sectorId) => {
      const scenario = createScenario(sectorId, 'テストシナリオ')
      const result = evaluateScenario(scenario)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      for (const key of Object.keys(KEY_METRICS_LABELS[sectorId])) {
        expect(result.value.keyMetrics).toHaveProperty(key)
      }
    },
  )

  it.each(['drug_discovery', 'medical_device', 'climate_tech'] as const)(
    '%s: 現状ラベル表は空(§1.2-1の記載どおり)',
    (sectorId) => {
      expect(Object.keys(KEY_METRICS_LABELS[sectorId])).toHaveLength(0)
    },
  )
})
