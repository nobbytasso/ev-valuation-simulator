import { useEffect, useRef, useState } from 'react'
import { StaticJsonSource } from '../../../adapters/benchmarks/StaticJsonSource.ts'
import type { BenchmarkData } from '../../../adapters/benchmarks/types.ts'
import { evaluateClimateTech } from '../../../engine/index.ts'
import type { Scenario } from '../../../store/scenarioTypes.ts'
import { BenchmarkComparisonSection } from '../../BenchmarkComparisonSection.tsx'
import { EvRangeResult } from '../../EvRangeResult.tsx'
import { VcMethodSection } from '../../VcMethodSection.tsx'
import '../../sectorScenarioView.css'
import { ClimateTechForm } from './ClimateTechForm.tsx'
import { CLIMATE_TECH_BENCHMARK_METRICS } from './climateTechBenchmarkMetrics.ts'
import { CLIMATE_TECH_PRESETS } from './climateTechPresets.ts'

type ClimateTechScenario = Extract<Scenario, { sector: 'climate_tech' }>

export interface ClimateTechScenarioViewProps {
  scenario: ClimateTechScenario
  onSave: (next: ClimateTechScenario) => void
  onDelete: () => void
}

/**
 * クライメートテックセクターの結果ビュー。
 * 出典: docs/requirements-rev4.md §3.6, §4.1.2, §4.1.1
 */
export function ClimateTechScenarioView({ scenario, onSave, onDelete }: ClimateTechScenarioViewProps) {
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
    void new StaticJsonSource().fetchSector('climate_tech').then((data) => {
      if (!cancelled) setBenchmark(data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const result = evaluateClimateTech(draftInputs)
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
          {CLIMATE_TECH_PRESETS.map((preset) => (
            <button key={preset.id} type="button" onClick={() => applyPreset(preset.inputs)}>
              <strong>{preset.label}</strong>
              <span>{preset.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>入力ドライバー</h2>
        <ClimateTechForm inputs={draftInputs} onChange={setDraftInputs} />
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
        <EvRangeResult result={result} />
      </section>

      {result.ok && (
        <VcMethodSection evRange={result.value.ev} vcMethod={draftVcMethod} onChange={setDraftVcMethod} />
      )}

      <BenchmarkComparisonSection
        benchmark={benchmark}
        metrics={CLIMATE_TECH_BENCHMARK_METRICS}
        inputs={draftInputs}
        keyMetrics={result.ok ? result.value.keyMetrics : undefined}
      />
    </div>
  )
}
