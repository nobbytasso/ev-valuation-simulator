import { useEffect, useMemo, useRef, useState } from 'react'
import {
  V2_SECTOR_IDS,
  type FieldDefinition,
  type InvestmentCase,
  type V2SectorId,
  type WorkbenchState,
} from '../domain/types.ts'
import {
  createDefaultWorkbench,
  getSectorDefinition,
  resetForSector,
  V2_SECTOR_LABELS,
} from '../domain/sectorDefinitions.ts'
import {
  exportWorkbenchJson,
  importWorkbenchJson,
  loadWorkbench,
  saveWorkbench,
} from '../store/workbenchStorage.ts'
import { downloadWorkbenchWorkbook } from './workbenchExcel.ts'
import { formatMoney } from '../../ui/format/money.ts'
import { useMoneyUnit } from '../../ui/format/useMoneyUnit.ts'
import './InvestmentWorkbenchPage.css'

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

function displayedValue(value: number | string | undefined, field: FieldDefinition): number | string {
  if (value === undefined) return ''
  if (typeof value === 'string') return value
  return field.format === 'percent' ? value * 100 : value
}

function storedValue(raw: string, field: FieldDefinition): number | string {
  if (field.kind === 'select') return raw
  const value = Number(raw)
  return field.format === 'percent' ? value / 100 : value
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

export function InvestmentWorkbenchPage() {
  const { unit } = useMoneyUnit()
  const [state, setState] = useState<WorkbenchState>(() => loadWorkbench())
  const [importError, setImportError] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement | null>(null)
  const definition = getSectorDefinition(state.company.sector)
  const results = useMemo(
    () => state.cases.map((investmentCase) => definition.evaluate(state.company, investmentCase)),
    [definition, state.company, state.cases],
  )

  useEffect(() => {
    saveWorkbench(state)
  }, [state])

  const updateCompany = (patch: Partial<WorkbenchState['company']>) => {
    setState((current) => ({
      ...current,
      company: { ...current.company, ...patch },
      updatedAt: new Date().toISOString(),
    }))
  }

  const updateCompanyFact = (key: string, value: number | string) => {
    setState((current) => ({
      ...current,
      company: {
        ...current.company,
        facts: { ...current.company.facts, [key]: value },
      },
      updatedAt: new Date().toISOString(),
    }))
  }

  const updateCase = (caseId: string, patch: Partial<InvestmentCase>) => {
    setState((current) => ({
      ...current,
      cases: current.cases.map((item) => (item.id === caseId ? { ...item, ...patch } : item)),
      updatedAt: new Date().toISOString(),
    }))
  }

  const updateCaseAssumption = (caseId: string, key: string, value: number | string) => {
    setState((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === caseId
          ? { ...item, assumptions: { ...item.assumptions, [key]: value } }
          : item,
      ),
      updatedAt: new Date().toISOString(),
    }))
  }

  const handleSectorChange = (sector: V2SectorId) => {
    setState((current) => resetForSector(current, sector))
  }

  const handleImport = async (file: File) => {
    try {
      const imported = importWorkbenchJson(await file.text())
      setState(imported)
      setImportError(null)
    } catch (error) {
      setImportError(`インポートに失敗しました: ${(error as Error).message}`)
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
                setState(createDefaultWorkbench(state.company.sector, state.company.name))
              }
            }}
          >
            リセット
          </button>
        </div>
      </header>

      {importError && <p className="status-bad" role="alert">{importError}</p>}
      {state.notices.length > 0 && (
        <section className="panel workbench-notices">
          <h2>移行時の確認事項</h2>
          <ul>
            {state.notices.map((notice) => <li key={notice}>{notice}</li>)}
          </ul>
          <button type="button" onClick={() => setState((current) => ({ ...current, notices: [] }))}>
            確認済みにする
          </button>
        </section>
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
          {state.cases.map((item) => (
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
            </article>
          ))}
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
