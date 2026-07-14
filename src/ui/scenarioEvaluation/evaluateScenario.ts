/**
 * セクター横断の評価ディスパッチ。出典: docs/phase5-spec.md §1.1
 *
 * SectorView(switch)・buildTornadoRows(sensitivityRegistry.ts)と同じ隔離パターン。
 * SectorId は store 層の語彙でありエンジンには置けないため、UI層に配置する。
 * 既存6ビューの個別 evaluateX 呼び出しは置き換えない(Phase 5 のスコープ外)。
 */
import type { EngineResult, SectorValuationResult } from '../../engine/index.ts'
import {
  evaluateClimateTech,
  evaluateDrugDiscovery,
  evaluateEcD2c,
  evaluateMediaTech,
  evaluateMedicalDevice,
  evaluateSaas,
} from '../../engine/index.ts'
import type { Scenario } from '../../store/scenarioTypes.ts'

export function evaluateScenario(scenario: Scenario): EngineResult<SectorValuationResult> {
  switch (scenario.sector) {
    case 'saas_jp':
      return evaluateSaas(scenario.inputs)
    case 'drug_discovery':
      return evaluateDrugDiscovery(scenario.inputs)
    case 'medical_device':
      return evaluateMedicalDevice(scenario.inputs)
    case 'media_tech':
      return evaluateMediaTech(scenario.inputs)
    case 'ec_d2c':
      return evaluateEcD2c(scenario.inputs)
    case 'climate_tech':
      return evaluateClimateTech(scenario.inputs)
  }
}
