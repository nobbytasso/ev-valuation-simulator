import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { StaticJsonSource } from '../adapters/benchmarks/StaticJsonSource.ts'
import type { DataStatus } from '../adapters/benchmarks/types.ts'
import { useScenarioStore } from '../store/scenarioStore.ts'
import { SECTOR_LABELS } from '../store/scenarioTypes.ts'
import type { Scenario } from '../store/scenarioTypes.ts'
import { buildScenarioWorkbook } from './excel/buildScenarioWorkbook.ts'
import { downloadXlsxFile } from './excel/downloadXlsxFile.ts'
import { ClimateTechScenarioView } from './sectors/climateTech/ClimateTechScenarioView.tsx'
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

/** セクターごとの専用ビューへディスパッチする。全6セクター実装済み(Phase 3完了)。 */
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
    case 'climate_tech':
      return <ClimateTechScenarioView scenario={scenario} onSave={onSave} onDelete={onDelete} />
  }
}

export function ScenarioDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { scenarios, isLoaded, loadAll, save, remove } = useScenarioStore()
  const [benchmarkDataStatus, setBenchmarkDataStatus] = useState<DataStatus | 'unknown'>('unknown')

  useEffect(() => {
    if (!isLoaded) void loadAll()
  }, [isLoaded, loadAll])

  const scenario = scenarios.find((s) => s.id === id)

  useEffect(() => {
    if (!scenario) return
    let cancelled = false
    void new StaticJsonSource().fetchSector(scenario.sector).then((data) => {
      if (!cancelled) setBenchmarkDataStatus(data?.data_status ?? 'unknown')
    })
    return () => {
      cancelled = true
    }
  }, [scenario])

  if (!isLoaded) return <p>読み込み中...</p>
  if (!scenario) return <p>シナリオが見つかりません。</p>

  const handleSave = (next: Scenario) => {
    void save(next)
  }
  const handleDelete = () => {
    void remove(scenario.id).then(() => navigate('/'))
  }
  const handleExportXlsx = () => {
    const workbook = buildScenarioWorkbook(scenario, benchmarkDataStatus)
    downloadXlsxFile(`${scenario.name}.xlsx`, workbook)
  }

  return (
    <section>
      <h1>{scenario.name}</h1>
      <p>セクター: {SECTOR_LABELS[scenario.sector]}</p>
      <button type="button" onClick={handleExportXlsx}>
        Excelエクスポート
      </button>
      <SectorView scenario={scenario} onSave={handleSave} onDelete={handleDelete} />
    </section>
  )
}
