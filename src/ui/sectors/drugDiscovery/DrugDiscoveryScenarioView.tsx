import { useEffect, useRef, useState } from 'react'
import { StaticJsonSource } from '../../../adapters/benchmarks/StaticJsonSource.ts'
import type { BenchmarkData } from '../../../adapters/benchmarks/types.ts'
import { PHASE_ORDER, evaluateDrugDiscovery } from '../../../engine/index.ts'
import type { PipelineAsset } from '../../../engine/index.ts'
import type { Scenario } from '../../../store/scenarioTypes.ts'
import { BenchmarkComparisonSection } from '../../BenchmarkComparisonSection.tsx'
import { EvRangeResult } from '../../EvRangeResult.tsx'
import { VcMethodSection } from '../../VcMethodSection.tsx'
import '../../sectorScenarioView.css'
import { DrugDiscoveryForm } from './DrugDiscoveryForm.tsx'
import { DRUG_DISCOVERY_BENCHMARK_METRICS } from './drugDiscoveryBenchmarkMetrics.ts'
import { DRUG_DISCOVERY_PRESETS } from './drugDiscoveryPresets.ts'

type DrugDiscoveryScenario = Extract<Scenario, { sector: 'drug_discovery' }>

export interface DrugDiscoveryScenarioViewProps {
  scenario: DrugDiscoveryScenario
  onSave: (next: DrugDiscoveryScenario) => void
  onDelete: () => void
}

/** 残フェーズの成功確率を掛け合わせた上市確率(POS)。エンジンの§2.2定義式そのまま。 */
function computePos(asset: PipelineAsset): number {
  const idx = PHASE_ORDER.indexOf(asset.currentPhase)
  const remaining = PHASE_ORDER.slice(idx)
  return remaining.reduce((acc, phase) => acc * asset.phaseSuccessProbs[phase], 1)
}

/**
 * 創薬セクターの結果ビュー。
 * 出典: docs/requirements-rev4.md §3.2, §4.1.2, §4.1.1
 */
export function DrugDiscoveryScenarioView({ scenario, onSave, onDelete }: DrugDiscoveryScenarioViewProps) {
  const [draftInputs, setDraftInputs] = useState(scenario.inputs)
  const [draftVcMethod, setDraftVcMethod] = useState(scenario.vcMethod)
  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null)

  const lastSyncedId = useRef<string | null>(null)
  useEffect(() => {
    if (lastSyncedId.current !== scenario.id) {
      setDraftInputs(scenario.inputs)
      setDraftVcMethod(scenario.vcMethod)
      lastSyncedId.current = scenario.id
    }
  }, [scenario])

  useEffect(() => {
    let cancelled = false
    void new StaticJsonSource().fetchSector('drug_discovery').then((data) => {
      if (!cancelled) setBenchmark(data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const result = evaluateDrugDiscovery(draftInputs)
  const isDirty = draftInputs !== scenario.inputs || draftVcMethod !== scenario.vcMethod

  const handleSave = () => {
    onSave({ ...scenario, inputs: draftInputs, vcMethod: draftVcMethod })
  }

  // プリセット適用はdraftの差し替えのみ(保存は「保存」ボタンで明示的に行う。C-7)。
  const applyPreset = (presetInputs: typeof draftInputs) => {
    setDraftInputs(presetInputs)
  }

  return (
    <div className="sector-scenario-view">
      <section>
        <h2>シナリオプリセット</h2>
        <div className="sector-scenario-view__presets">
          {DRUG_DISCOVERY_PRESETS.map((preset) => (
            <button key={preset.id} type="button" onClick={() => applyPreset(preset.inputs)}>
              <strong>{preset.label}</strong>
              <span>{preset.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>入力ドライバー</h2>
        <DrugDiscoveryForm inputs={draftInputs} onChange={setDraftInputs} />
        <div className="sector-scenario-view__actions">
          <button type="button" onClick={handleSave} disabled={!isDirty}>
            保存
          </button>
          <button type="button" onClick={onDelete}>
            シナリオを削除
          </button>
        </div>
      </section>

      <section>
        <h2>結果</h2>
        <EvRangeResult result={result}>
          <ul>
            {draftInputs.assets.map((asset, i) => (
              <li key={i}>
                {asset.name}: 上市確率(POS) {(computePos(asset) * 100).toFixed(1)}%
              </li>
            ))}
          </ul>
        </EvRangeResult>
      </section>

      {result.ok && (
        <VcMethodSection evRange={result.value.ev} vcMethod={draftVcMethod} onChange={setDraftVcMethod} />
      )}

      <BenchmarkComparisonSection
        benchmark={benchmark}
        metrics={DRUG_DISCOVERY_BENCHMARK_METRICS}
        inputs={draftInputs}
        keyMetrics={result.ok ? result.value.keyMetrics : undefined}
      />
    </div>
  )
}
