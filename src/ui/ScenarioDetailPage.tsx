import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useScenarioStore } from '../store/scenarioStore.ts'
import { SECTOR_LABELS } from '../store/scenarioTypes.ts'
import type { Scenario } from '../store/scenarioTypes.ts'
import { GenericScenarioView } from './GenericScenarioView.tsx'
import { DrugDiscoveryScenarioView } from './sectors/drugDiscovery/DrugDiscoveryScenarioView.tsx'
import { EcD2cScenarioView } from './sectors/ecD2c/EcD2cScenarioView.tsx'
import { MedicalDeviceScenarioView } from './sectors/medicalDevice/MedicalDeviceScenarioView.tsx'
import { MediaTechScenarioView } from './sectors/mediaTech/MediaTechScenarioView.tsx'
import { SaasScenarioView } from './sectors/saas/SaasScenarioView.tsx'

interface SectorViewProps {
  scenario: Scenario
  onSave: (next: Scenario) => void
  onDelete: () => void
}

/**
 * セクターごとの専用ビューへディスパッチする。専用ビュー未実装のセクターは
 * GenericScenarioView(生JSON編集)にフォールバックする。
 */
function SectorView({ scenario, onSave, onDelete }: SectorViewProps) {
  switch (scenario.sector) {
    case 'saas_jp':
      return <SaasScenarioView scenario={scenario} onSave={onSave} onDelete={onDelete} />
    case 'ec_d2c':
      return <EcD2cScenarioView scenario={scenario} onSave={onSave} onDelete={onDelete} />
    case 'media_tech':
      return <MediaTechScenarioView scenario={scenario} onSave={onSave} onDelete={onDelete} />
    case 'medical_device':
      return <MedicalDeviceScenarioView scenario={scenario} onSave={onSave} onDelete={onDelete} />
    case 'drug_discovery':
      return <DrugDiscoveryScenarioView scenario={scenario} onSave={onSave} onDelete={onDelete} />
    default:
      return <GenericScenarioView scenario={scenario} onSave={onSave} onDelete={onDelete} />
  }
}

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
      <SectorView scenario={scenario} onSave={handleSave} onDelete={handleDelete} />
    </section>
  )
}
