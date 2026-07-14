import { useEffect, useRef, useState } from 'react'
import { StaticJsonSource } from '../../../adapters/benchmarks/StaticJsonSource.ts'
import type { BenchmarkData } from '../../../adapters/benchmarks/types.ts'
import { evaluateSaas } from '../../../engine/index.ts'
import type { Scenario } from '../../../store/scenarioTypes.ts'
import { BenchmarkComparisonSection } from '../../BenchmarkComparisonSection.tsx'
import { CapitalPolicySection } from '../../capitalPolicy/CapitalPolicySection.tsx'
import { CashflowChart } from '../../cashflow/CashflowChart.tsx'
import { EvRangeResult } from '../../EvRangeResult.tsx'
import { SectionHeading } from '../../SectionHeading.tsx'
import { CircularGauge } from '../../gauge/CircularGauge.tsx'
import { RULE_OF_40_DISPLAY_MAX, RULE_OF_40_INDUSTRY_STANDARD, normalizeRatio } from '../../gauge/gaugeConstants.ts'
import { KeyMetricsList } from '../../scenarioEvaluation/KeyMetricsList.tsx'
import { SensitivitySection } from '../../sensitivity/SensitivitySection.tsx'
import { useScanReveal } from '../../../theme-effects/index.ts'
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
          {SAAS_PRESETS.map((preset) => (
            <button key={preset.id} type="button" onClick={() => applyPreset(preset.inputs)}>
              <strong>{preset.label}</strong>
              <span>{preset.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading captionKey="inputDrivers">入力ドライバー</SectionHeading>
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

      <section className={scanActive ? 'scan-active' : undefined}>
        <SectionHeading captionKey="result">結果</SectionHeading>
        <EvRangeResult result={result}>
          <KeyMetricsList sector="saas_jp" keyMetrics={result.ok ? result.value.keyMetrics : undefined} />
          {result.ok && result.value.keyMetrics.ruleOf40 !== undefined && (
            <CircularGauge
              label="Rule of 40"
              value={result.value.keyMetrics.ruleOf40}
              valueText={`${result.value.keyMetrics.ruleOf40.toFixed(1)} pt`}
              ratio={normalizeRatio(result.value.keyMetrics.ruleOf40, RULE_OF_40_DISPLAY_MAX)}
              markerRatio={RULE_OF_40_INDUSTRY_STANDARD / RULE_OF_40_DISPLAY_MAX}
            />
          )}
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
        metrics={SAAS_BENCHMARK_METRICS}
        inputs={draftInputs}
        keyMetrics={result.ok ? result.value.keyMetrics : undefined}
      />
    </div>
  )
}
