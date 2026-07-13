import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  evaluateClimateTech,
  evaluateDrugDiscovery,
  evaluateEcD2c,
  evaluateMediaTech,
  evaluateMedicalDevice,
  evaluateSaas,
} from '../engine/index.ts'
import type { EngineResult, SectorValuationResult } from '../engine/index.ts'
import { useScenarioStore } from '../store/scenarioStore.ts'
import { SECTOR_LABELS } from '../store/scenarioTypes.ts'
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

/**
 * 検証済みエンジンを呼んで結果を素の表で表示するだけの仮画面。
 * 入力編集は生JSONのtextarea(セクター別フォームはPhase 3で実装)。
 */
export function ScenarioDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { scenarios, isLoaded, loadAll, save, remove } = useScenarioStore()
  const [inputsText, setInputsText] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [result, setResult] = useState<EngineResult<SectorValuationResult> | null>(null)

  useEffect(() => {
    if (!isLoaded) void loadAll()
  }, [isLoaded, loadAll])

  const scenario = scenarios.find((s) => s.id === id)

  // シナリオ切替時のみテキストエリアを初期化する(編集中の内容を保つため、ストア更新の
  // たびには再初期化しない。lastSyncedIdで「別シナリオに切り替わった」ときだけ検知する)
  const lastSyncedId = useRef<string | null>(null)
  useEffect(() => {
    if (scenario && lastSyncedId.current !== scenario.id) {
      setInputsText(JSON.stringify(scenario.inputs, null, 2))
      lastSyncedId.current = scenario.id
    }
  }, [scenario])

  if (!isLoaded) return <p>読み込み中...</p>
  if (!scenario) return <p>シナリオが見つかりません。</p>

  const handleCalculate = async () => {
    setParseError(null)
    let parsedInputs: unknown
    try {
      parsedInputs = JSON.parse(inputsText)
    } catch (e) {
      setParseError(`JSONの解析に失敗しました: ${(e as Error).message}`)
      return
    }
    const updated = { ...scenario, inputs: parsedInputs } as Scenario
    await save(updated)
    setResult(evaluateScenario(updated))
  }

  const handleDelete = async () => {
    await remove(scenario.id)
    navigate('/')
  }

  return (
    <section>
      <h1>{scenario.name}</h1>
      <p>セクター: {SECTOR_LABELS[scenario.sector]}</p>

      <h2>入力(JSON)</h2>
      <textarea value={inputsText} onChange={(e) => setInputsText(e.target.value)} rows={20} cols={80} />
      {parseError && <p role="alert">{parseError}</p>}

      <div>
        <button type="button" onClick={handleCalculate}>
          適用して計算
        </button>
        <button type="button" onClick={handleDelete}>
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
    </section>
  )
}
