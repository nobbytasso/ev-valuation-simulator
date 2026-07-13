import { useEffect, useRef, useState } from 'react'
import { StaticJsonSource } from '../../../adapters/benchmarks/StaticJsonSource.ts'
import type { BenchmarkData } from '../../../adapters/benchmarks/types.ts'
import { evaluateSaas } from '../../../engine/index.ts'
import type { Scenario } from '../../../store/scenarioTypes.ts'
import { BenchmarkComparisonSection } from '../../BenchmarkComparisonSection.tsx'
import { EvRangeResult } from '../../EvRangeResult.tsx'
import { VcMethodSection } from '../../VcMethodSection.tsx'
import { SaasForm } from './SaasForm.tsx'
import { SAAS_BENCHMARK_METRICS } from './saasBenchmarkMetrics.ts'
import { SAAS_PRESETS } from './saasPresets.ts'
import './SaasScenarioView.css'

type SaasScenario = Extract<Scenario, { sector: 'saas_jp' }>

export interface SaasScenarioViewProps {
  scenario: SaasScenario
  onSave: (next: SaasScenario) => void
  onDelete: () => void
}

/**
 * SaaS(日本)セクターの結果ビュー。
 * 出典: docs/requirements-rev4.md §3.1, §4.1.2, §4.1.1
 */
export function SaasScenarioView({ scenario, onSave, onDelete }: SaasScenarioViewProps) {
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
    void new StaticJsonSource().fetchSector('saas_jp').then((data) => {
      if (!cancelled) setBenchmark(data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const result = evaluateSaas(draftInputs)
  const isDirty = draftInputs !== scenario.inputs || draftVcMethod !== scenario.vcMethod

  const handleSave = () => {
    onSave({ ...scenario, inputs: draftInputs, vcMethod: draftVcMethod })
  }

  const applyPreset = (presetInputs: typeof draftInputs) => {
    setDraftInputs(presetInputs)
    onSave({ ...scenario, inputs: presetInputs, vcMethod: draftVcMethod })
  }

  return (
    <div className="saas-view">
      <section>
        <h2>シナリオプリセット</h2>
        <div className="saas-view__presets">
          {SAAS_PRESETS.map((preset) => (
            <button key={preset.id} type="button" onClick={() => applyPreset(preset.inputs)}>
              <strong>{preset.label}</strong>
              <span>{preset.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>入力ドライバー</h2>
        <SaasForm inputs={draftInputs} onChange={setDraftInputs} />
        <div className="saas-view__actions">
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
          {result.ok && <p>Rule of 40: {result.value.keyMetrics.ruleOf40?.toFixed(1)} pt</p>}
        </EvRangeResult>
      </section>

      {result.ok && (
        <VcMethodSection evRange={result.value.ev} vcMethod={draftVcMethod} onChange={setDraftVcMethod} />
      )}

      <BenchmarkComparisonSection
        benchmark={benchmark}
        metrics={SAAS_BENCHMARK_METRICS}
        inputs={draftInputs}
        keyMetrics={result.ok ? result.value.keyMetrics : undefined}
      />
    </div>
  )
}
