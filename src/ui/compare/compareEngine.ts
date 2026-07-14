/**
 * シナリオ並列比較ビューの集計ロジック(純粋関数)。出典: docs/phase5-spec.md §2
 *
 * 数表とチャートは同じ計算結果(evaluateScenario)を共有し、式の二重評価をしない(§2.3)。
 */
import type { EngineResult, Ratio, SectorValuationResult } from '../../engine/index.ts'
import { validateDilutionInputs, simulateDilution } from '../../engine/index.ts'
import type { DilutionInputs } from '../../engine/index.ts'
import type { Scenario, SectorId } from '../../store/scenarioTypes.ts'
import { SENSITIVITY_REGISTRY } from '../sensitivity/sensitivityRegistry.ts'
import { evaluateScenario } from '../scenarioEvaluation/evaluateScenario.ts'
import type { FieldFormat } from '../scenarioEvaluation/fieldLabelTypes.ts'
import { KEY_METRICS_LABELS } from '../scenarioEvaluation/keyMetricsLabels.ts'
import { CLIMATE_TECH_FIELD_LABELS } from '../sectors/climateTech/climateTechFieldLabels.ts'
import { DRUG_DISCOVERY_FIELD_LABELS } from '../sectors/drugDiscovery/drugDiscoveryFieldLabels.ts'
import { EC_D2C_FIELD_LABELS } from '../sectors/ecD2c/ecD2cFieldLabels.ts'
import { MEDIA_TECH_FIELD_LABELS } from '../sectors/mediaTech/mediaTechFieldLabels.ts'
import { MEDICAL_DEVICE_FIELD_LABELS } from '../sectors/medicalDevice/medicalDeviceFieldLabels.ts'
import { SAAS_FIELD_LABELS } from '../sectors/saas/saasFieldLabels.ts'
import type { SectorFieldLabelTable } from '../scenarioEvaluation/fieldLabelTypes.ts'

/** 比較件数上限(P5-6裁定)。 */
export const MAX_COMPARE_SCENARIOS = 4

const FIELD_LABEL_TABLES: Record<SectorId, SectorFieldLabelTable> = {
  saas_jp: SAAS_FIELD_LABELS,
  drug_discovery: DRUG_DISCOVERY_FIELD_LABELS,
  medical_device: MEDICAL_DEVICE_FIELD_LABELS,
  media_tech: MEDIA_TECH_FIELD_LABELS,
  ec_d2c: EC_D2C_FIELD_LABELS,
  climate_tech: CLIMATE_TECH_FIELD_LABELS,
}

export interface ExpectedReturns {
  irr: Ratio | null
  moic: number | null
  /** null以外は irr/moic とも「—」表示にする理由(CapitalPolicySectionと同じ文言)。 */
  unavailableReason: string | null
}

export interface CompareColumn {
  id: string
  found: boolean
  scenario: Scenario | null
  evaluation: EngineResult<SectorValuationResult> | null
  expectedReturns: ExpectedReturns | null
}

/**
 * 期待IRR/MOIC。simulateDilution(exitEvSourceは各シナリオの保存値)で算出する(§2.2-1)。
 * CapitalPolicySectionと同じガード: EV−netDebt ≤ 0 ・validateDilutionInputsのissue・
 * 自ファンド出資なし(fundIrr/fundMoicがnull)はすべて「—」+理由。
 */
export function computeExpectedReturns(scenario: Scenario, evaluation: EngineResult<SectorValuationResult>): ExpectedReturns {
  if (!evaluation.ok) {
    return { irr: null, moic: null, unavailableReason: '評価不能' }
  }
  const equityValue = evaluation.value.ev[scenario.capitalPolicy.exitEvSource] - scenario.vcMethod.netDebtAtExit
  if (equityValue <= 0) {
    return { irr: null, moic: null, unavailableReason: 'Exit株式価値が0以下' }
  }
  const dilutionInputs: DilutionInputs = {
    initialCapTable: scenario.capitalPolicy.initialCapTable,
    rounds: scenario.capitalPolicy.rounds,
    exit: { yearIndex: scenario.vcMethod.yearsToExit, equityValue },
  }
  const issues = validateDilutionInputs(dilutionInputs)
  if (issues.length > 0) {
    return { irr: null, moic: null, unavailableReason: '資本政策の入力エラー' }
  }
  const result = simulateDilution(dilutionInputs)
  if (result.fundIrr === null && result.fundMoic === null) {
    return { irr: null, moic: null, unavailableReason: '自ファンドの出資がありません' }
  }
  return { irr: result.fundIrr, moic: result.fundMoic, unavailableReason: null }
}

/** ids(URLクエリ由来)からシナリオを解決し、比較列一式を構築する。不明idは found:false の列として残す(§2.1)。 */
export function buildCompareColumns(ids: string[], scenarios: Scenario[]): CompareColumn[] {
  return ids.slice(0, MAX_COMPARE_SCENARIOS).map((id) => {
    const scenario = scenarios.find((s) => s.id === id) ?? null
    if (!scenario) {
      return { id, found: false, scenario: null, evaluation: null, expectedReturns: null }
    }
    const evaluation = evaluateScenario(scenario)
    return { id, found: true, scenario, evaluation, expectedReturns: computeExpectedReturns(scenario, evaluation) }
  })
}

export interface EvChartDatum {
  name: string
  pessimistic: number
  base: number
  optimistic: number
}

/** EVレンジのグループ棒チャート用データ(§2.3)。評価不能・未検出の列は含めない。 */
export function buildEvChartData(columns: CompareColumn[]): EvChartDatum[] {
  const data: EvChartDatum[] = []
  for (const col of columns) {
    if (!col.found || !col.scenario || !col.evaluation?.ok) continue
    data.push({
      name: col.scenario.name,
      pessimistic: col.evaluation.value.ev.pessimistic,
      base: col.evaluation.value.ev.base,
      optimistic: col.evaluation.value.ev.optimistic,
    })
  }
  return data
}

export interface SectorBlockRow {
  key: string
  label: string
  format: FieldFormat
  unit: string
  /** columnId → 生値(未検出・評価不能・値なしは null) */
  valuesByColumnId: Record<string, number | null>
}

export interface SectorBlock {
  sector: SectorId
  /** このブロックに属する列(同一セクターの列のみ、元の並び順を維持)。 */
  columnIds: string[]
  rows: SectorBlockRow[]
}

function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[key]
  }, obj)
}

/** 創薬は driverIds がパス形式(assets[].*)のため、簡略化した3行固定表示にする(§2.2-2)。 */
function buildDrugDiscoveryRows(columns: CompareColumn[]): SectorBlockRow[] {
  const assetCount: SectorBlockRow = { key: 'assetCount', label: '品目数', format: 'number', unit: '件', valuesByColumnId: {} }
  const totalPeakSales: SectorBlockRow = {
    key: 'totalPeakSales',
    label: '合計ピーク売上',
    format: 'money',
    unit: '百万円',
    valuesByColumnId: {},
  }
  const discountRateBase: SectorBlockRow = {
    key: 'discountRateBase',
    label: '割引率(ベース)',
    format: 'ratio',
    unit: '%',
    valuesByColumnId: {},
  }
  for (const col of columns) {
    if (!col.scenario || col.scenario.sector !== 'drug_discovery') continue
    const inputs = col.scenario.inputs
    assetCount.valuesByColumnId[col.id] = inputs.assets.length
    totalPeakSales.valuesByColumnId[col.id] = inputs.assets.reduce((sum, a) => sum + a.peakSales, 0)
    discountRateBase.valuesByColumnId[col.id] = inputs.discountRate.base
  }
  return [assetCount, totalPeakSales, discountRateBase]
}

/** セクター別の SENSITIVITY_REGISTRY エントリを型安全に呼び分ける(sensitivityRegistry.ts の buildTornadoRows と同じswitchパターン)。 */
function listDriverIdsFor(scenario: Scenario): string[] {
  switch (scenario.sector) {
    case 'saas_jp':
      return SENSITIVITY_REGISTRY.saas_jp.listDriverIds(scenario.inputs)
    case 'medical_device':
      return SENSITIVITY_REGISTRY.medical_device.listDriverIds(scenario.inputs)
    case 'media_tech':
      return SENSITIVITY_REGISTRY.media_tech.listDriverIds(scenario.inputs)
    case 'ec_d2c':
      return SENSITIVITY_REGISTRY.ec_d2c.listDriverIds(scenario.inputs)
    case 'climate_tech':
      return SENSITIVITY_REGISTRY.climate_tech.listDriverIds(scenario.inputs)
    case 'drug_discovery':
      return []
  }
}

function driverLabelFor(scenario: Scenario, driverId: string): string {
  switch (scenario.sector) {
    case 'saas_jp':
      return SENSITIVITY_REGISTRY.saas_jp.driverLabel(driverId, scenario.inputs)
    case 'medical_device':
      return SENSITIVITY_REGISTRY.medical_device.driverLabel(driverId, scenario.inputs)
    case 'media_tech':
      return SENSITIVITY_REGISTRY.media_tech.driverLabel(driverId, scenario.inputs)
    case 'ec_d2c':
      return SENSITIVITY_REGISTRY.ec_d2c.driverLabel(driverId, scenario.inputs)
    case 'climate_tech':
      return SENSITIVITY_REGISTRY.climate_tech.driverLabel(driverId, scenario.inputs)
    case 'drug_discovery':
      return driverId
  }
}

/** SENSITIVITY_REGISTRY の driverIds を「比較で見るべき主要入力」として流用する(§2.2-2。新しい選定基準を発明しない)。 */
function buildDriverRows(sector: Exclude<SectorId, 'drug_discovery'>, columns: CompareColumn[]): SectorBlockRow[] {
  const table = FIELD_LABEL_TABLES[sector]
  const sectorColumns = columns.filter((c) => c.scenario?.sector === sector)
  if (sectorColumns.length === 0) return []
  const firstScenario = sectorColumns[0].scenario as Scenario
  const driverIds = listDriverIdsFor(firstScenario)
  return driverIds.map((driverId): SectorBlockRow => {
    const fieldEntry = table.scalars[driverId]
    const row: SectorBlockRow = {
      key: driverId,
      label: driverLabelFor(firstScenario, driverId),
      format: fieldEntry?.format ?? 'number',
      unit: fieldEntry?.unit ?? '',
      valuesByColumnId: {},
    }
    for (const col of columns) {
      if (col.scenario?.sector !== sector) continue
      const value = getByPath(col.scenario.inputs, driverId)
      row.valuesByColumnId[col.id] = typeof value === 'number' ? value : null
    }
    return row
  })
}

function buildKeyMetricRows(sector: SectorId, columns: CompareColumn[]): SectorBlockRow[] {
  const labels = KEY_METRICS_LABELS[sector]
  return Object.entries(labels).map(([key, { label, format }]): SectorBlockRow => {
    const row: SectorBlockRow = {
      key,
      label,
      format: format === 'pt' ? 'number' : format === 'x' ? 'number' : format === 'yen' ? 'yen' : format === 'ratio' ? 'ratio' : 'number',
      unit: format === 'pt' ? 'pt' : format === 'x' ? 'x' : format === 'months' ? '月' : format === 'years' ? '年' : format === 'yen' ? '円' : '%',
      valuesByColumnId: {},
    }
    for (const col of columns) {
      if (col.scenario?.sector !== sector || !col.evaluation?.ok) continue
      const value = col.evaluation.value.keyMetrics[key]
      row.valuesByColumnId[col.id] = typeof value === 'number' ? value : null
    }
    return row
  })
}

/**
 * セクター別ブロック。同一セクターの列が2件以上のときのみ生成する(§2.2-2)。
 * keyMetrics行 + 主要ドライバー行(創薬は3行固定)を並べる。
 */
export function buildSectorBlocks(columns: CompareColumn[]): SectorBlock[] {
  const bySector = new Map<SectorId, string[]>()
  for (const col of columns) {
    if (!col.scenario) continue
    const list = bySector.get(col.scenario.sector) ?? []
    list.push(col.id)
    bySector.set(col.scenario.sector, list)
  }

  const blocks: SectorBlock[] = []
  for (const [sector, columnIds] of bySector) {
    if (columnIds.length < 2) continue
    const driverRows = sector === 'drug_discovery' ? buildDrugDiscoveryRows(columns) : buildDriverRows(sector, columns)
    const rows = [...buildKeyMetricRows(sector, columns), ...driverRows]
    blocks.push({ sector, columnIds, rows })
  }
  return blocks
}
