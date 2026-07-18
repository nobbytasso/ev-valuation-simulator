import { useEffect, useMemo, useRef, useState } from 'react'
import {
  V2_SECTOR_IDS,
  type FieldDefinition,
  type InvestmentCase,
  type V2SectorId,
  type WorkbenchCollection,
  type WorkbenchState,
} from '../domain/types.ts'
import {
  createDefaultWorkbench,
  getSectorDefinition,
  resetForSector,
  V2_SECTOR_LABELS,
} from '../domain/sectorDefinitions.ts'
import {
  addCompanyToCollection,
  duplicateCompanyInCollection,
  exportWorkbenchJson,
  loadWorkbenchCollection,
  parseWorkbenchImport,
  removeCompanyFromCollection,
  saveWorkbenchCollection,
  withActiveWorkbenchUpdated,
} from '../store/workbenchStorage.ts'
import { MIGRATION_CASE_FACTORS, migrateLegacyScenario } from '../store/legacyMigration.ts'
import type { CaseFactorTuple, MigrationCaseFactors } from '../store/legacyMigration.ts'
import { downloadWorkbenchWorkbook } from '../../ui/excel/buildWorkbenchWorkbook.ts'
import { formatMoney, formatMoneyValue, moneyAxisLabel } from '../../ui/format/money.ts'
import { useMoneyUnit } from '../../ui/format/useMoneyUnit.ts'
import { useStableListKeys } from '../../ui/useStableListKeys.ts'
import { CategoryBarChart } from '../../ui/charts/CategoryBarChart.tsx'
import { computeFollowOnReturn } from '../../engine/index.ts'
import type { WorkbenchFollowOnInput } from '../../engine/index.ts'
import { displayedValue, storedValue } from './workbenchFieldFormat.ts'
import './InvestmentWorkbenchPage.css'

function createDefaultFollowOn(index: number): WorkbenchFollowOnInput {
  return { label: `追加出資${index + 1}`, yearOffset: 1, amount: 100, postMoney: 3000 }
}

function formatFollowOnMultiple(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '—' : `×${value.toFixed(2)}`
}

function formatPercent(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(1)}%`
}

function formatMultiple(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '—' : `${value.toFixed(2)}x`
}

function formatSharePrice(value: number | null): string {
  return value === null || !Number.isFinite(value)
    ? '—'
    : `${value.toLocaleString('ja-JP', { maximumFractionDigits: 1 })} 円`
}

/** 会社を新しい既定値に差し替える系の操作(セクター変更・リセット・JSONインポート)は、
 *  会社idをコレクション内のスロットキーとして保っている必要がある(activeCompanyIdが
 *  指すスロットを差し替えるだけにし、新しい会社が増殖しないようにする)。 */
function preserveCompanyId(fresh: WorkbenchState, id: string): WorkbenchState {
  return { ...fresh, company: { ...fresh.company, id } }
}

interface DynamicFieldProps {
  field: FieldDefinition
  value: number | string | undefined
  onChange: (value: number | string) => void
}

function DynamicField({ field, value, onChange }: DynamicFieldProps) {
  return (
    <label className="workbench-field">
      <span>{field.label}</span>
      {field.kind === 'select' ? (
        <select value={String(value ?? '')} onChange={(event) => onChange(event.target.value)}>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="number"
          step={field.step ?? 'any'}
          min={field.min !== undefined ? displayedValue(field.min, field) : undefined}
          max={field.max !== undefined ? displayedValue(field.max, field) : undefined}
          value={displayedValue(value, field)}
          onChange={(event) => onChange(storedValue(event.target.value, field))}
        />
      )}
      {field.description && <small>{field.description}</small>}
    </label>
  )
}

function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

// 移行係数パネル(docs/v2-adoption-spec.md §3、裁定③)で編集する「主要係数」1本(4ケース分)を
// セクターごとに選ぶ。定数表 MIGRATION_CASE_FACTORS のうち、成長率・成功確率など
// 展開結果に最も影響する係数を割り当てる。
const PRIMARY_FACTOR_LABEL: Record<V2SectorId, string> = {
  saas_jp: 'ARR成長率 係数',
  ec_d2c: '売上成長率 係数',
  media_tech: 'MAU成長率 係数',
  medical_device: '対象手技数成長率 係数',
  drug_discovery: '上市成功確率 係数',
  climate_tech: '量産化到達確率・オフテイクカバー率 係数',
}

function getPrimaryFactorTuple(factors: MigrationCaseFactors, sector: V2SectorId): CaseFactorTuple {
  switch (sector) {
    case 'saas_jp':
      return factors.saas_jp.growthFactor
    case 'ec_d2c':
      return factors.ec_d2c.growthFactor
    case 'media_tech':
      return factors.media_tech.growthFactor
    case 'medical_device':
      return factors.medical_device.growthFactor
    case 'drug_discovery':
      return factors.drug_discovery.posFactor
    case 'climate_tech':
      return factors.climate_tech.probabilityFactor
  }
}

function withPrimaryFactorTuple(
  factors: MigrationCaseFactors,
  sector: V2SectorId,
  tuple: CaseFactorTuple,
): MigrationCaseFactors {
  switch (sector) {
    case 'saas_jp':
      return { ...factors, saas_jp: { ...factors.saas_jp, growthFactor: tuple } }
    case 'ec_d2c':
      return { ...factors, ec_d2c: { ...factors.ec_d2c, growthFactor: tuple } }
    case 'media_tech':
      return { ...factors, media_tech: { ...factors.media_tech, growthFactor: tuple } }
    case 'medical_device':
      return { ...factors, medical_device: { ...factors.medical_device, growthFactor: tuple } }
    case 'drug_discovery':
      return { ...factors, drug_discovery: { ...factors.drug_discovery, posFactor: tuple } }
    case 'climate_tech':
      return { ...factors, climate_tech: { ...factors.climate_tech, probabilityFactor: tuple } }
  }
}

export function InvestmentWorkbenchPage() {
  const { unit } = useMoneyUnit()
  const [collection, setCollection] = useState<WorkbenchCollection>(() => loadWorkbenchCollection())
  const [importError, setImportError] = useState<string | null>(null)
  const [legacyRaw, setLegacyRaw] = useState<unknown | null>(null)
  const [migrationFactors, setMigrationFactors] = useState<MigrationCaseFactors>(() =>
    structuredClone(MIGRATION_CASE_FACTORS),
  )
  const importRef = useRef<HTMLInputElement | null>(null)

  const companies = useMemo(
    () => Object.values(collection.workbenches).sort((a, b) => a.company.name.localeCompare(b.company.name, 'ja')),
    [collection.workbenches],
  )
  const state = collection.workbenches[collection.activeCompanyId] ?? companies[0]

  const definition = getSectorDefinition(state.company.sector)
  const results = useMemo(
    () => state.cases.map((investmentCase) => definition.evaluate(state.company, investmentCase)),
    [definition, state.company, state.cases],
  )

  // 追加出資行のReact keyはケース毎に独立管理する(ケースは常に4件固定なのでフック数は不変)。
  // 出典: docs/v2-adoption-spec.md §6.2、CapitalPolicySection.tsx と同じuseStableListKeysパターン。
  const followOnKeys = [
    useStableListKeys(state.cases[0]?.followOns.length ?? 0),
    useStableListKeys(state.cases[1]?.followOns.length ?? 0),
    useStableListKeys(state.cases[2]?.followOns.length ?? 0),
    useStableListKeys(state.cases[3]?.followOns.length ?? 0),
  ]
  const lastSyncedCompanyId = useRef<string | null>(null)
  useEffect(() => {
    if (lastSyncedCompanyId.current !== state.company.id) {
      state.cases.forEach((item, index) => followOnKeys[index]?.reset(item.followOns.length))
      lastSyncedCompanyId.current = state.company.id
    }
    // followOnKeysは会社切替のたびに新しいフック配列参照になるため依存配列には含めない
    // (companyId変化時のみ同期する。CapitalPolicySection.tsxと同じ設計)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.company.id])

  const followOnResults = useMemo(
    () =>
      state.cases.map((item, index) =>
        computeFollowOnReturn(
          {
            investmentAmount: item.investmentAmount,
            proposedPreMoney: state.company.proposedPreMoney,
            yearsToExit: item.yearsToExit,
            dilutionRetention: item.dilutionRetention,
          },
          item.followOns,
          results[index]?.exitEquityValue ?? 0,
        ),
      ),
    [state.cases, state.company.proposedPreMoney, results],
  )

  useEffect(() => {
    saveWorkbenchCollection(collection)
  }, [collection])

  const updateActive = (updater: (current: WorkbenchState) => WorkbenchState) => {
    setCollection((current) => withActiveWorkbenchUpdated(current, updater))
  }

  const updateCompany = (patch: Partial<WorkbenchState['company']>) => {
    updateActive((current) => ({ ...current, company: { ...current.company, ...patch } }))
  }

  const updateCompanyFact = (key: string, value: number | string) => {
    updateActive((current) => ({
      ...current,
      company: { ...current.company, facts: { ...current.company.facts, [key]: value } },
    }))
  }

  const updateCase = (caseId: string, patch: Partial<InvestmentCase>) => {
    updateActive((current) => ({
      ...current,
      cases: current.cases.map((item) => (item.id === caseId ? { ...item, ...patch } : item)),
    }))
  }

  const updateCaseAssumption = (caseId: string, key: string, value: number | string) => {
    updateActive((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === caseId
          ? { ...item, assumptions: { ...item.assumptions, [key]: value } }
          : item,
      ),
    }))
  }

  const addFollowOn = (caseIndex: number, caseId: string) => {
    updateActive((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === caseId ? { ...item, followOns: [...item.followOns, createDefaultFollowOn(item.followOns.length)] } : item,
      ),
    }))
    followOnKeys[caseIndex]?.push()
  }

  const updateFollowOn = (caseId: string, rowIndex: number, patch: Partial<WorkbenchFollowOnInput>) => {
    updateActive((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === caseId
          ? { ...item, followOns: item.followOns.map((row, i) => (i === rowIndex ? { ...row, ...patch } : row)) }
          : item,
      ),
    }))
  }

  const removeFollowOn = (caseIndex: number, caseId: string, rowIndex: number) => {
    updateActive((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === caseId ? { ...item, followOns: item.followOns.filter((_, i) => i !== rowIndex) } : item,
      ),
    }))
    followOnKeys[caseIndex]?.removeAt(rowIndex)
  }

  const handleSectorChange = (sector: V2SectorId) => {
    updateActive((current) => preserveCompanyId(resetForSector(current, sector), current.company.id))
  }

  const handleSwitchCompany = (companyId: string) => {
    if (!collection.workbenches[companyId]) return
    setCollection((current) => ({ ...current, activeCompanyId: companyId }))
  }

  const handleAddCompany = () => {
    setCollection((current) => addCompanyToCollection(current))
  }

  const handleDuplicateCompany = () => {
    setCollection((current) => duplicateCompanyInCollection(current, current.activeCompanyId))
  }

  const handleRemoveCompany = () => {
    if (companies.length <= 1) return
    if (!window.confirm(`「${state.company.name}」を削除しますか？この操作は取り消せません。`)) return
    setCollection((current) => removeCompanyFromCollection(current, current.activeCompanyId))
  }

  const handleImport = async (file: File) => {
    try {
      const defaultFactors = structuredClone(MIGRATION_CASE_FACTORS)
      const { state: imported, legacyRaw: raw } = parseWorkbenchImport(await file.text(), defaultFactors)
      // インポートは現在アクティブな会社スロットを差し替える(会社idは維持し、コレクションに
      // 空の会社スロットが増殖しないようにする)。他の会社には影響しない。
      updateActive(() => preserveCompanyId(imported, state.company.id))
      setLegacyRaw(raw)
      setMigrationFactors(defaultFactors)
      setImportError(null)
    } catch (error) {
      setImportError(`インポートに失敗しました: ${(error as Error).message}`)
    }
  }

  const handleReExpand = () => {
    if (legacyRaw === null) return
    try {
      const reExpanded = migrateLegacyScenario(legacyRaw, migrationFactors)
      updateActive(() => preserveCompanyId(reExpanded, state.company.id))
      setImportError(null)
    } catch (error) {
      setImportError(`再展開に失敗しました: ${(error as Error).message}`)
    }
  }

  const commonCaseFields: FieldDefinition[] = [
    { id: 'yearsToExit', label: 'Exitまでの年数', format: 'number', step: 1, min: 1 },
    { id: 'targetMoic', label: '目標MOIC', format: 'multiple', step: 0.1, min: 0.1 },
    { id: 'investmentAmount', label: '投資額', format: 'money', step: 10, min: 0 },
    { id: 'dilutionRetention', label: 'Exit時持分残存率', format: 'percent', step: 1, min: 0.01, max: 1 },
    { id: 'exitNetDebt', label: 'Exit Net Debt', format: 'money', step: 10 },
  ]

  const caseCommonValue = (item: InvestmentCase, key: string): number => {
    const value = item[key as keyof InvestmentCase]
    return typeof value === 'number' ? value : 0
  }

  return (
    <div className="investment-workbench">
      <header className="investment-workbench__hero">
        <div>
          <p className="investment-workbench__eyebrow">INVESTMENT CASE WORKBENCH / V2</p>
          <h1>企業価値・投資リターン シナリオ設計</h1>
          <p>
            会社固有の現在値と、会社計画・引受・Downside・Severe Downsideを分離し、
            Exit価値から現在の理論株価まで一気通貫で計算します。
          </p>
        </div>
        <div className="investment-workbench__actions">
          <button
            type="button"
            onClick={() => downloadText(`${state.company.name}_workbench.json`, exportWorkbenchJson(state))}
          >
            JSONエクスポート
          </button>
          <button type="button" onClick={() => importRef.current?.click()}>
            JSONインポート
          </button>
          <input
            ref={importRef}
            hidden
            type="file"
            accept="application/json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleImport(file)
              event.target.value = ''
            }}
          />
          <button type="button" onClick={() => downloadWorkbenchWorkbook(state, results)}>
            Excelエクスポート
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('現在の入力をセクター既定値に戻しますか？')) {
                updateActive((current) =>
                  preserveCompanyId(createDefaultWorkbench(current.company.sector, current.company.name), current.company.id),
                )
              }
            }}
          >
            リセット
          </button>
        </div>
      </header>

      <section className="panel workbench-company-switcher" aria-label="会社の切り替え">
        <label className="workbench-field">
          <span>会社（{companies.length}社）</span>
          <select value={state.company.id} onChange={(event) => handleSwitchCompany(event.target.value)}>
            {companies.map((c) => (
              <option key={c.company.id} value={c.company.id}>
                {c.company.name}（{V2_SECTOR_LABELS[c.company.sector]}）
              </option>
            ))}
          </select>
        </label>
        <div className="investment-workbench__actions">
          <button type="button" onClick={handleAddCompany}>
            会社を追加
          </button>
          <button type="button" onClick={handleDuplicateCompany}>
            会社を複製
          </button>
          <button type="button" onClick={handleRemoveCompany} disabled={companies.length <= 1}>
            会社を削除
          </button>
        </div>
      </section>

      {importError && <p className="status-bad" role="alert">{importError}</p>}
      {state.notices.length > 0 && (
        <section className="panel workbench-notices">
          <h2>移行時の確認事項</h2>
          <ul>
            {state.notices.map((notice) => <li key={notice}>{notice}</li>)}
          </ul>
          <button type="button" onClick={() => updateActive((current) => ({ ...current, notices: [] }))}>
            確認済みにする
          </button>
        </section>
      )}

      {legacyRaw !== null && (
        <details className="panel workbench-migration-factors">
          <summary>移行係数(旧Scenarioからの近似展開)</summary>
          <p>
            旧Scenarioの悲観・ベース・楽観を4つの独立ケースへ近似展開する際の係数です。既定値は
            セクター毎の定数表(MIGRATION_CASE_FACTORS)。編集後「この係数で再展開」を押すと、
            直前にインポートした旧JSONをこの係数で再展開します(係数自体は保存されません)。
          </p>
          <div className="workbench-grid workbench-grid--company">
            {state.cases.map((item, index) => (
              <label key={item.id} className="workbench-field">
                <span>
                  {item.name}: {PRIMARY_FACTOR_LABEL[state.company.sector]}
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={getPrimaryFactorTuple(migrationFactors, state.company.sector)[index]}
                  onChange={(event) => {
                    const tuple = [...getPrimaryFactorTuple(migrationFactors, state.company.sector)] as CaseFactorTuple
                    tuple[index] = Number(event.target.value)
                    setMigrationFactors((current) => withPrimaryFactorTuple(current, state.company.sector, tuple))
                  }}
                />
              </label>
            ))}
          </div>
          <div className="investment-workbench__actions">
            <button type="button" onClick={handleReExpand}>
              この係数で再展開
            </button>
            <button
              type="button"
              onClick={() => setMigrationFactors(structuredClone(MIGRATION_CASE_FACTORS))}
            >
              係数を既定値に戻す
            </button>
          </div>
        </details>
      )}

      <section className="panel">
        <div className="workbench-section-heading">
          <div>
            <p>COMPANY FACTS</p>
            <h2>会社の現在値</h2>
          </div>
          <span>シナリオを変えても維持する事実情報</span>
        </div>

        <div className="workbench-grid workbench-grid--company">
          <label className="workbench-field">
            <span>会社名</span>
            <input value={state.company.name} onChange={(event) => updateCompany({ name: event.target.value })} />
          </label>
          <label className="workbench-field">
            <span>セクター</span>
            <select
              value={state.company.sector}
              onChange={(event) => handleSectorChange(event.target.value as V2SectorId)}
            >
              {V2_SECTOR_IDS.map((sector) => (
                <option key={sector} value={sector}>{V2_SECTOR_LABELS[sector]}</option>
              ))}
            </select>
          </label>
          <label className="workbench-field">
            <span>評価基準日</span>
            <input
              type="date"
              value={state.company.valuationDate}
              onChange={(event) => updateCompany({ valuationDate: event.target.value })}
            />
          </label>
          <label className="workbench-field">
            <span>完全希薄化後株式数（百万株）</span>
            <input
              type="number"
              step="0.1"
              min="0"
              value={state.company.fullyDilutedShares}
              onChange={(event) => updateCompany({ fullyDilutedShares: Number(event.target.value) })}
            />
          </label>
          <label className="workbench-field">
            <span>提示Pre-money（百万円）</span>
            <input
              type="number"
              step="100"
              value={state.company.proposedPreMoney}
              onChange={(event) => updateCompany({ proposedPreMoney: Number(event.target.value) })}
            />
          </label>
          <label className="workbench-field">
            <span>現在Net Debt（百万円）</span>
            <input
              type="number"
              step="10"
              value={state.company.currentNetDebt}
              onChange={(event) => updateCompany({ currentNetDebt: Number(event.target.value) })}
            />
          </label>
          {definition.companyFields.map((field) => (
            <DynamicField
              key={field.id}
              field={field}
              value={state.company.facts[field.id]}
              onChange={(value) => updateCompanyFact(field.id, value)}
            />
          ))}
        </div>
        <p className="workbench-formula">
          <strong>{definition.valuationMethod}</strong> — {definition.formulaSummary}
        </p>
      </section>

      <section className="panel">
        <div className="workbench-section-heading">
          <div>
            <p>CASE ASSUMPTIONS</p>
            <h2>4ケースの前提</h2>
          </div>
          <span>1列を1本の投資ストーリーとして管理</span>
        </div>

        <div className="workbench-case-grid">
          {state.cases.map((item, caseIndex) => {
            const followOnResult = followOnResults[caseIndex]
            return (
            <article key={item.id} className="workbench-case-card">
              <input
                className="workbench-case-card__title"
                value={item.name}
                onChange={(event) => updateCase(item.id, { name: event.target.value })}
              />
              <textarea
                rows={3}
                value={item.narrative}
                onChange={(event) => updateCase(item.id, { narrative: event.target.value })}
              />
              <label className="workbench-field">
                <span>Exitルート</span>
                <select
                  value={item.exitRoute}
                  onChange={(event) =>
                    updateCase(item.id, { exitRoute: event.target.value as InvestmentCase['exitRoute'] })
                  }
                >
                  <option value="ipo">IPO</option>
                  <option value="ma">M&amp;A</option>
                  <option value="secondary">Secondary</option>
                  <option value="milestone">Milestone / License</option>
                </select>
              </label>
              {commonCaseFields.map((field) => (
                <DynamicField
                  key={field.id}
                  field={field}
                  value={caseCommonValue(item, field.id)}
                  onChange={(value) => updateCase(item.id, { [field.id]: value } as Partial<InvestmentCase>)}
                />
              ))}
              <hr />
              {definition.caseFields.map((field) => (
                <DynamicField
                  key={field.id}
                  field={field}
                  value={item.assumptions[field.id]}
                  onChange={(value) => updateCaseAssumption(item.id, field.id, value)}
                />
              ))}
              <hr />
              <div className="workbench-followon">
                <div className="workbench-followon__heading">
                  <span>追加出資</span>
                  <button type="button" onClick={() => addFollowOn(caseIndex, item.id)}>
                    ＋ 追加出資を追加
                  </button>
                </div>
                {item.followOns.length === 0 ? (
                  <p className="workbench-followon__empty">初回投資のみ(追加出資なし)</p>
                ) : (
                  item.followOns.map((row, rowIndex) => {
                    const tranche = followOnResult?.tranches[rowIndex]
                    const multiple = tranche?.multipleOfPreviousPostMoney ?? null
                    return (
                      <div
                        key={followOnKeys[caseIndex]?.keys[rowIndex] ?? String(rowIndex)}
                        className="workbench-followon__row"
                      >
                        <input
                          className="workbench-followon__label"
                          value={row.label}
                          onChange={(event) => updateFollowOn(item.id, rowIndex, { label: event.target.value })}
                        />
                        <label className="workbench-field">
                          <span>初回投資からの経過年数</span>
                          <input
                            type="number"
                            step={1}
                            min={0}
                            value={row.yearOffset}
                            onChange={(event) => updateFollowOn(item.id, rowIndex, { yearOffset: Number(event.target.value) })}
                          />
                        </label>
                        <label className="workbench-field">
                          <span>追加出資額（百万円）</span>
                          <input
                            type="number"
                            step={10}
                            min={0}
                            value={row.amount}
                            onChange={(event) => updateFollowOn(item.id, rowIndex, { amount: Number(event.target.value) })}
                          />
                        </label>
                        <label className="workbench-field">
                          <span>ラウンドPost-money（百万円）</span>
                          <input
                            type="number"
                            step={100}
                            min={0}
                            value={row.postMoney}
                            onChange={(event) => updateFollowOn(item.id, rowIndex, { postMoney: Number(event.target.value) })}
                          />
                        </label>
                        <p
                          className={`workbench-followon__multiple ${
                            multiple === null ? '' : multiple >= 1 ? 'status-good' : 'status-bad'
                          }`}
                        >
                          前回Post-money比: {formatFollowOnMultiple(multiple)}
                        </p>
                        <button type="button" onClick={() => removeFollowOn(caseIndex, item.id, rowIndex)}>
                          この追加出資を削除
                        </button>
                      </div>
                    )
                  })
                )}
                {followOnResult && followOnResult.totalOwnershipShare > 1 && (
                  <p className="status-bad" role="alert">
                    初回+追加出資の持分合計が{formatPercent(followOnResult.totalOwnershipShare)}
                    となり100%を超えています。
                  </p>
                )}
                {followOnResult && (
                  <p className="workbench-followon__summary">
                    通算MOIC: {formatMultiple(followOnResult.moic)} / 通算IRR: {formatPercent(followOnResult.irr)}
                  </p>
                )}
              </div>
            </article>
            )
          })}
        </div>
      </section>

      <section className="panel">
        <div className="workbench-section-heading">
          <div>
            <p>VALUATION BRIDGE</p>
            <h2>投資ケース比較</h2>
          </div>
          <span>Exit KPIから理論株価・期待IRRまで</span>
        </div>

        <div className="workbench-topline-chart">
          <p className="workbench-topline-chart__label">{results[0]?.exitMetricLabel ?? 'Exit KPI'}比較</p>
          <CategoryBarChart
            data={state.cases.map((item, index) => ({ name: item.name, value: results[index]?.exitMetric ?? 0 }))}
            formatValue={(value) => formatMoney(value, unit)}
            formatAxisValue={(value) => formatMoneyValue(value, unit)}
            axisLabel={moneyAxisLabel(unit)}
          />
        </div>

        <div className="workbench-table-wrap">
          <table className="workbench-results">
            <thead>
              <tr>
                <th>項目</th>
                {state.cases.map((item) => <th key={item.id}>{item.name}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Exitルート / 年数</td>
                {state.cases.map((item) => <td key={item.id}>{item.exitRoute.toUpperCase()} / {item.yearsToExit}年</td>)}
              </tr>
              <tr>
                <td>{results[0]?.exitMetricLabel ?? 'Exit KPI'}</td>
                {results.map((result, index) => <td key={state.cases[index].id}>{formatMoney(result.exitMetric, unit)}</td>)}
              </tr>
              <tr>
                <td>Exit企業価値</td>
                {results.map((result, index) => <td key={state.cases[index].id}>{formatMoney(result.exitEnterpriseValue, unit)}</td>)}
              </tr>
              <tr>
                <td>Exit株式価値</td>
                {results.map((result, index) => <td key={state.cases[index].id}>{formatMoney(result.exitEquityValue, unit)}</td>)}
              </tr>
              <tr className="workbench-results__emphasis">
                <td>現在許容Post-money</td>
                {results.map((result, index) => <td key={state.cases[index].id}>{formatMoney(result.currentAllowablePostMoney, unit)}</td>)}
              </tr>
              <tr className="workbench-results__emphasis">
                <td>現在許容Pre-money</td>
                {results.map((result, index) => <td key={state.cases[index].id}>{formatMoney(result.currentAllowablePreMoney, unit)}</td>)}
              </tr>
              <tr className="workbench-results__emphasis">
                <td>現在理論株価</td>
                {results.map((result, index) => <td key={state.cases[index].id}>{formatSharePrice(result.theoreticalSharePrice)}</td>)}
              </tr>
              <tr>
                <td>提示Pre-money比</td>
                {results.map((result, index) => (
                  <td
                    key={state.cases[index].id}
                    className={
                      result.valuationGapToProposed === null
                        ? undefined
                        : result.valuationGapToProposed >= 0
                          ? 'status-good'
                          : 'status-bad'
                    }
                  >
                    {formatPercent(result.valuationGapToProposed)}
                  </td>
                ))}
              </tr>
              <tr>
                <td>要求投資時持分</td>
                {results.map((result, index) => <td key={state.cases[index].id}>{formatPercent(result.requiredEntryOwnership)}</td>)}
              </tr>
              <tr>
                <td>目標MOICの含意IRR</td>
                {results.map((result, index) => <td key={state.cases[index].id}>{formatPercent(result.impliedTargetIrr)}</td>)}
              </tr>
              <tr>
                <td>提示条件での期待Exit持分</td>
                {results.map((result, index) => <td key={state.cases[index].id}>{formatPercent(result.expectedExitOwnership)}</td>)}
              </tr>
              <tr>
                <td>提示条件での期待MOIC</td>
                {results.map((result, index) => <td key={state.cases[index].id}>{formatMultiple(result.expectedMoic)}</td>)}
              </tr>
              <tr>
                <td>提示条件での期待IRR</td>
                {results.map((result, index) => <td key={state.cases[index].id}>{formatPercent(result.expectedIrr)}</td>)}
              </tr>
              {results.some((result) => result.intrinsicValue !== undefined) && (
                <tr>
                  <td>現在Intrinsic Value</td>
                  {results.map((result, index) => (
                    <td key={state.cases[index].id}>
                      {result.intrinsicValue === undefined ? '—' : formatMoney(result.intrinsicValue, unit)}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="workbench-section-heading">
          <div>
            <p>VALIDATION</p>
            <h2>ケース別の警告</h2>
          </div>
        </div>
        <div className="workbench-warning-grid">
          {results.map((result, index) => (
            <article key={state.cases[index].id}>
              <h3>{state.cases[index].name}</h3>
              {result.warnings.length === 0 ? (
                <p className="status-good">重大な計算警告はありません。</p>
              ) : (
                <ul>
                  {result.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
