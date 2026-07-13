import { useEffect, useRef, useState } from 'react'
import { StaticJsonSource } from '../../../adapters/benchmarks/StaticJsonSource.ts'
import type { BenchmarkData } from '../../../adapters/benchmarks/types.ts'
import { evaluateSaas } from '../../../engine/index.ts'
import type { Scenario } from '../../../store/scenarioTypes.ts'
import { BenchmarkComparisonSection } from '../../BenchmarkComparisonSection.tsx'
import { CapitalPolicySection } from '../../capitalPolicy/CapitalPolicySection.tsx'
import { EvRangeResult } from '../../EvRangeResult.tsx'
import { SensitivitySection } from '../../sensitivity/SensitivitySection.tsx'
import { VcMethodSection } from '../../VcMethodSection.tsx'
import { SaasForm } from './SaasForm.tsx'
import { SAAS_BENCHMARK_METRICS } from './saasBenchmarkMetrics.ts'
import { SAAS_PRESETS } from './saasPresets.ts'
import '../../sectorScenarioView.css'

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
  const [draftCapitalPolicy, setDraftCapitalPolicy] = useState(scenario.capitalPolicy)
  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null)

  const lastSyncedId = useRef<string | null>(null)
  useEffect(() => {
    if (lastSyncedId.current !== scenario.id) {
      setDraftInputs(scenario.inputs)
      setDraftVcMethod(scenario.vcMethod)
      setDraftCapitalPolicy(scenario.capitalPolicy)
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
  const isDirty =
    draftInputs !== scenario.inputs ||
    draftVcMethod !== scenario.vcMethod ||
    draftCapitalPolicy !== scenario.capitalPolicy

  const handleSave = () => {
    onSave({ ...scenario, inputs: draftInputs, vcMethod: draftVcMethod, capitalPolicy: draftCapitalPolicy })
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
          {result.ok && <p>Rule of 40: {result.value.keyMetrics.ruleOf40?.toFixed(1)} pt</p>}
        </EvRangeResult>
      </section>

      {result.ok && (
        <VcMethodSection evRange={result.value.ev} vcMethod={draftVcMethod} onChange={setDraftVcMethod} />
      )}

      {result.ok && (
        <CapitalPolicySection
          scenarioId={scenario.id}
          evRange={result.value.ev}
          vcMethod={draftVcMethod}
          capitalPolicy={draftCapitalPolicy}
          onChange={setDraftCapitalPolicy}
        />
      )}

      <SensitivitySection scenario={{ ...scenario, inputs: draftInputs }} />

      <BenchmarkComparisonSection
        benchmark={benchmark}
        metrics={SAAS_BENCHMARK_METRICS}
        inputs={draftInputs}
        keyMetrics={result.ok ? result.value.keyMetrics : undefined}
      />
    </div>
  )
}
