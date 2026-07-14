import { useEffect, useRef, useState } from 'react'
import { StaticJsonSource } from '../../../adapters/benchmarks/StaticJsonSource.ts'
import type { BenchmarkData } from '../../../adapters/benchmarks/types.ts'
import { evaluateClimateTech } from '../../../engine/index.ts'
import type { Scenario } from '../../../store/scenarioTypes.ts'
import { BenchmarkComparisonSection } from '../../BenchmarkComparisonSection.tsx'
import { CapitalPolicySection } from '../../capitalPolicy/CapitalPolicySection.tsx'
import { CashflowChart } from '../../cashflow/CashflowChart.tsx'
import { EvRangeResult } from '../../EvRangeResult.tsx'
import { SectionHeading } from '../../SectionHeading.tsx'
import { KeyMetricsList } from '../../scenarioEvaluation/KeyMetricsList.tsx'
import { SensitivitySection } from '../../sensitivity/SensitivitySection.tsx'
import { useScanReveal } from '../../../theme-effects/index.ts'
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
    void new StaticJsonSource().fetchSector('climate_tech').then((data) => {
      if (!cancelled) setBenchmark(data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const result = evaluateClimateTech(draftInputs)
  const isDirty =
    draftInputs !== scenario.inputs ||
    draftVcMethod !== scenario.vcMethod ||
    draftCapitalPolicy !== scenario.capitalPolicy

  const handleSave = () => {
    onSave({ ...scenario, inputs: draftInputs, vcMethod: draftVcMethod, capitalPolicy: draftCapitalPolicy })
  }

  // プリセット適用はdraftの差し替えのみ(保存は「保存」ボタンで明示的に行う。C-7)。
  const [presetApplyCount, setPresetApplyCount] = useState(0)
  const applyPreset = (presetInputs: typeof draftInputs) => {
    setDraftInputs(presetInputs)
    setPresetApplyCount((c) => c + 1)
  }
  // ダークのスキャン走査(§6.1)。プリセット適用時+シナリオ切替時のみ発火(P6-8裁定)。
  const scanActive = useScanReveal(`${scenario.id}:${presetApplyCount}`)

  return (
    <div className="sector-scenario-view">
      <section>
        <SectionHeading captionKey="presets">シナリオプリセット</SectionHeading>
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
        <SectionHeading captionKey="inputDrivers">入力ドライバー</SectionHeading>
        {/* シナリオ切替時にCAPEX行のkey管理状態(D-12)をリセットするためkeyでリマウントする */}
        <ClimateTechForm key={scenario.id} inputs={draftInputs} onChange={setDraftInputs} />
        <div className="sector-scenario-view__actions">
          <button type="button" onClick={handleSave} disabled={!isDirty}>
            保存
          </button>
          <button type="button" onClick={onDelete}>
            シナリオを削除
          </button>
        </div>
      </section>

      <section className={scanActive ? 'scan-active' : undefined}>
        <SectionHeading captionKey="result">結果</SectionHeading>
        <EvRangeResult result={result}>
          <KeyMetricsList sector="climate_tech" keyMetrics={result.ok ? result.value.keyMetrics : undefined} />
          {result.ok && result.value.cashflows && <CashflowChart cashflows={result.value.cashflows} />}
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
        metrics={CLIMATE_TECH_BENCHMARK_METRICS}
        inputs={draftInputs}
        keyMetrics={result.ok ? result.value.keyMetrics : undefined}
      />
    </div>
  )
}
