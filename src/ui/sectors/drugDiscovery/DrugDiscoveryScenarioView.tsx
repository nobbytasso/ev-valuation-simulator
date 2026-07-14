import { useEffect, useRef, useState } from 'react'
import { StaticJsonSource } from '../../../adapters/benchmarks/StaticJsonSource.ts'
import type { BenchmarkData } from '../../../adapters/benchmarks/types.ts'
import { computeAssetPos, evaluateDrugDiscovery } from '../../../engine/index.ts'
import type { Scenario } from '../../../store/scenarioTypes.ts'
import { BenchmarkComparisonSection } from '../../BenchmarkComparisonSection.tsx'
import { CapitalPolicySection } from '../../capitalPolicy/CapitalPolicySection.tsx'
import { EvRangeResult } from '../../EvRangeResult.tsx'
import { SectionHeading } from '../../SectionHeading.tsx'
import { KeyMetricsList } from '../../scenarioEvaluation/KeyMetricsList.tsx'
import { SensitivitySection } from '../../sensitivity/SensitivitySection.tsx'
import { useScanReveal } from '../../../theme-effects/index.ts'
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

/**
 * 創薬セクターの結果ビュー。
 * 出典: docs/requirements-rev4.md §3.2, §4.1.2, §4.1.1
 */
export function DrugDiscoveryScenarioView({ scenario, onSave, onDelete }: DrugDiscoveryScenarioViewProps) {
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
    void new StaticJsonSource().fetchSector('drug_discovery').then((data) => {
      if (!cancelled) setBenchmark(data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const result = evaluateDrugDiscovery(draftInputs)
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
          {DRUG_DISCOVERY_PRESETS.map((preset) => (
            <button key={preset.id} type="button" onClick={() => applyPreset(preset.inputs)}>
              <strong>{preset.label}</strong>
              <span>{preset.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading captionKey="inputDrivers">入力ドライバー</SectionHeading>
        {/* シナリオ切替時に品目・マイルストーンのkey管理状態(D-12)をリセットするためkeyでリマウントする */}
        <DrugDiscoveryForm key={scenario.id} inputs={draftInputs} onChange={setDraftInputs} />
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
          <ul>
            {draftInputs.assets.map((asset, i) => (
              // 読み取り専用の表示リスト(入力なし・行固有のローカル状態なし)のためindex keyで問題ない。
              // 編集可能な品目リスト自体はDrugDiscoveryForm側でuuid由来のkeyを使用(D-12)。
              <li key={i}>
                {asset.name}: 上市確率(POS) {(computeAssetPos(asset) * 100).toFixed(1)}%
              </li>
            ))}
          </ul>
          <KeyMetricsList sector="drug_discovery" keyMetrics={result.ok ? result.value.keyMetrics : undefined} />
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
        metrics={DRUG_DISCOVERY_BENCHMARK_METRICS}
        inputs={draftInputs}
        keyMetrics={result.ok ? result.value.keyMetrics : undefined}
      />
    </div>
  )
}
