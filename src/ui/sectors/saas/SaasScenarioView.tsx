import { useEffect, useRef, useState } from 'react'
import { StaticJsonSource } from '../../../adapters/benchmarks/StaticJsonSource.ts'
import type { BenchmarkData } from '../../../adapters/benchmarks/types.ts'
import { evaluateSaas } from '../../../engine/index.ts'
import type { Scenario } from '../../../store/scenarioTypes.ts'
import { BenchmarkBar } from '../../BenchmarkBar.tsx'
import { DummyDataBadge } from '../../DummyDataBadge.tsx'
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
        {result.ok ? (
          <>
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>悲観</th>
                  <th>ベース</th>
                  <th>楽観</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>企業価値(百万円)</td>
                  <td>{result.value.ev.pessimistic.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}</td>
                  <td>{result.value.ev.base.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}</td>
                  <td>{result.value.ev.optimistic.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}</td>
                </tr>
              </tbody>
            </table>
            {result.value.auxiliary !== undefined && (
              <p>
                補助評価値(簡易DCF): {result.value.auxiliary.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}{' '}
                百万円
              </p>
            )}
            <p>Rule of 40: {result.value.keyMetrics.ruleOf40?.toFixed(1)} pt</p>
          </>
        ) : (
          <div role="alert">
            <h3>入力エラー</h3>
            <ul>
              {result.errors.map((err) => (
                <li key={err.code}>
                  {err.field}: {err.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {result.ok && (
        <VcMethodSection evRange={result.value.ev} vcMethod={draftVcMethod} onChange={setDraftVcMethod} />
      )}

      <section>
        <h2>
          ベンチマーク比較
          {benchmark?.data_status === 'dummy' && <DummyDataBadge />}
        </h2>
        {!benchmark ? (
          <p>ベンチマークデータを読み込み中...</p>
        ) : !result.ok ? (
          <p>入力エラーのため比較できません。</p>
        ) : (
          <>
            {SAAS_BENCHMARK_METRICS.map((metric) => {
              const entries = benchmark.benchmarks.filter((b) => b.metric_id === metric.metricId)
              const industryStandard = entries.find((e) => e.reference_type === 'industry_standard')
              const comps = entries
                .filter((e) => e.reference_type === 'comp_company')
                .map((c) => ({ name: c.company_name ?? '(不明)', value: c.value }))
              const currentValue = metric.getValue(draftInputs, result.value.keyMetrics)
              if (currentValue === undefined) return null
              return (
                <div key={metric.metricId} className="saas-view__benchmark-item">
                  <BenchmarkBar
                    label={metric.label}
                    unit={metric.unit}
                    currentValue={currentValue}
                    industryStandard={industryStandard?.value}
                    comps={comps}
                  />
                  {industryStandard && (
                    <p className="saas-view__benchmark-source">
                      出典: {industryStandard.source.name}(取得日: {industryStandard.source.retrieved_at})
                    </p>
                  )}
                </div>
              )
            })}
          </>
        )}
      </section>
    </div>
  )
}
