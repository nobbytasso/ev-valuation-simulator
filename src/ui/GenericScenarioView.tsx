import { useEffect, useRef, useState } from 'react'
import {
  evaluateClimateTech,
  evaluateDrugDiscovery,
  evaluateEcD2c,
  evaluateMediaTech,
  evaluateMedicalDevice,
  evaluateSaas,
} from '../engine/index.ts'
import type { EngineResult, SectorValuationResult } from '../engine/index.ts'
import type { Scenario } from '../store/scenarioTypes.ts'

function evaluateScenario(scenario: Scenario): EngineResult<SectorValuationResult> {
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

export interface GenericScenarioViewProps {
  scenario: Scenario
  onSave: (next: Scenario) => void
  onDelete: () => void
}

/**
 * 検証済みエンジンを呼んで結果を素の表で表示するだけの仮画面。
 * セクター別フォーム未実装の間の繋ぎ(専用ビューはPhase 3で順次SaaS→EC/D2C→
 * メディア→医療機器→創薬→クライメートの順に置き換える)。
 * 入力編集は生JSONのtextarea。
 */
export function GenericScenarioView({ scenario, onSave, onDelete }: GenericScenarioViewProps) {
  const [inputsText, setInputsText] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [result, setResult] = useState<EngineResult<SectorValuationResult> | null>(null)

  const lastSyncedId = useRef<string | null>(null)
  useEffect(() => {
    if (lastSyncedId.current !== scenario.id) {
      setInputsText(JSON.stringify(scenario.inputs, null, 2))
      lastSyncedId.current = scenario.id
    }
  }, [scenario])

  const handleCalculate = () => {
    setParseError(null)
    let parsedInputs: unknown
    try {
      parsedInputs = JSON.parse(inputsText)
    } catch (e) {
      setParseError(`JSONの解析に失敗しました: ${(e as Error).message}`)
      return
    }
    const updated = { ...scenario, inputs: parsedInputs } as Scenario
    onSave(updated)
    setResult(evaluateScenario(updated))
  }

  return (
    <div>
      <h2>入力(JSON)</h2>
      <textarea value={inputsText} onChange={(e) => setInputsText(e.target.value)} rows={20} cols={80} />
      {parseError && <p role="alert">{parseError}</p>}

      <div>
        <button type="button" onClick={handleCalculate}>
          適用して計算
        </button>
        <button type="button" onClick={onDelete}>
          削除
        </button>
      </div>

      {result &&
        (result.ok ? (
          <div>
            <h2>結果</h2>
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
                  <td>{result.value.ev.pessimistic.toLocaleString('ja-JP')}</td>
                  <td>{result.value.ev.base.toLocaleString('ja-JP')}</td>
                  <td>{result.value.ev.optimistic.toLocaleString('ja-JP')}</td>
                </tr>
              </tbody>
            </table>

            {result.value.auxiliary !== undefined && (
              <p>補助評価値(簡易DCF): {result.value.auxiliary.toLocaleString('ja-JP')} 百万円</p>
            )}

            {Object.keys(result.value.keyMetrics).length > 0 && (
              <>
                <h3>自動算出指標</h3>
                <table>
                  <tbody>
                    {Object.entries(result.value.keyMetrics).map(([key, value]) => (
                      <tr key={key}>
                        <td>{key}</td>
                        <td>{value.toLocaleString('ja-JP')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        ) : (
          <div role="alert">
            <h2>入力エラー</h2>
            <ul>
              {result.errors.map((err) => (
                <li key={err.code}>
                  {err.field}: {err.message}
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  )
}
