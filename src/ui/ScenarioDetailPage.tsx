import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useScenarioStore } from '../store/scenarioStore.ts'
import { SECTOR_LABELS } from '../store/scenarioTypes.ts'
import type { Scenario } from '../store/scenarioTypes.ts'
import { GenericScenarioView } from './GenericScenarioView.tsx'
import { EcD2cScenarioView } from './sectors/ecD2c/EcD2cScenarioView.tsx'
import { SaasScenarioView } from './sectors/saas/SaasScenarioView.tsx'

/**
 * シナリオ詳細ページ。セクターごとの専用ビューへディスパッチする。
 * 専用ビュー未実装のセクターは GenericScenarioView(生JSON編集)にフォールバックする。
 */
export function ScenarioDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { scenarios, isLoaded, loadAll, save, remove } = useScenarioStore()

  useEffect(() => {
    if (!isLoaded) void loadAll()
  }, [isLoaded, loadAll])

  const scenario = scenarios.find((s) => s.id === id)

  if (!isLoaded) return <p>読み込み中...</p>
  if (!scenario) return <p>シナリオが見つかりません。</p>

  const handleSave = (next: Scenario) => {
    void save(next)
  }
  const handleDelete = () => {
    void remove(scenario.id).then(() => navigate('/'))
  }

  return (
    <section>
      <h1>{scenario.name}</h1>
      <p>セクター: {SECTOR_LABELS[scenario.sector]}</p>

      {scenario.sector === 'saas_jp' ? (
        <SaasScenarioView scenario={scenario} onSave={handleSave} onDelete={handleDelete} />
      ) : scenario.sector === 'ec_d2c' ? (
        <EcD2cScenarioView scenario={scenario} onSave={handleSave} onDelete={handleDelete} />
      ) : (
        <GenericScenarioView scenario={scenario} onSave={handleSave} onDelete={handleDelete} />
      )}
    </section>
  )
}
