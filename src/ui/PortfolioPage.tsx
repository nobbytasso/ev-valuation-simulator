import { useEffect, useMemo, useState } from 'react'
import { usePortfolioStore } from '../store/portfolioStore.ts'
import { useScenarioStore } from '../store/scenarioStore.ts'
import { SECTOR_IDS, SECTOR_LABELS } from '../store/scenarioTypes.ts'
import type { PortfolioHolding, SectorId } from '../store/scenarioTypes.ts'
import { aggregatePortfolio, evaluateHolding } from './portfolio/portfolioAggregation.ts'
import './PortfolioPage.css'

function formatMoney(value: number | null): string {
  if (value === null) return '—'
  return `${value.toLocaleString('ja-JP', { maximumFractionDigits: 0 })} 百万円`
}
function formatPct(value: number | null): string {
  if (value === null) return '—'
  return `${(value * 100).toFixed(1)}%`
}
function formatMoic(value: number | null): string {
  if (value === null) return '—'
  return `${value.toFixed(2)}x`
}
function formatIrr(value: number | null, reason: string | null): string {
  if (value === null) return reason ? `—(${reason})` : '—'
  return formatPct(value)
}

/**
 * 仮想ポートフォリオ管理。出典: docs/requirements-rev4.md §4.1.3、docs/phase5-spec.md §3
 * ファンド単位集計(IRR/MOIC/時価総額)はシナリオ紐付けと資本政策シミュレーターの
 * どちらとも異なる「投資実績(投資日・投資額)と現在時価に基づく未実現値」である(§3.4)。
 */
export function PortfolioPage() {
  const { holdings, isLoaded, loadAll, addHolding, updateHolding, removeHolding } = usePortfolioStore()
  const { scenarios, isLoaded: scenariosLoaded, loadAll: loadScenarios } = useScenarioStore()
  const [companyName, setCompanyName] = useState('')
  const [sector, setSector] = useState<SectorId>('saas_jp')
  const [investmentAmount, setInvestmentAmount] = useState(0)
  const [round, setRound] = useState('シリーズA')
  const [ownershipPct, setOwnershipPct] = useState(0)
  const [investmentDate, setInvestmentDate] = useState('')

  useEffect(() => {
    if (!isLoaded) void loadAll()
  }, [isLoaded, loadAll])
  useEffect(() => {
    if (!scenariosLoaded) void loadScenarios()
  }, [scenariosLoaded, loadScenarios])

  // 評価基準日=今日(P5-4裁定)。new Date() はこのコンポーネントに閉じ、集計ロジックには文字列で渡す。
  const evalDateIso = useMemo(() => new Date().toISOString(), [])
  const scenarioById = useMemo(() => new Map(scenarios.map((s) => [s.id, s])), [scenarios])

  const handleAdd = async () => {
    if (!companyName) return
    await addHolding({
      companyName,
      sector,
      investmentAmount,
      round,
      ownershipPct,
      investmentDate: investmentDate || null,
    })
    setCompanyName('')
    setInvestmentAmount(0)
    setOwnershipPct(0)
    setInvestmentDate('')
  }

  const linkScenario = (holding: PortfolioHolding, scenarioId: string) => {
    void updateHolding({ ...holding, scenarioId: scenarioId || undefined })
  }
  const setHoldingInvestmentDate = (holding: PortfolioHolding, value: string) => {
    void updateHolding({ ...holding, investmentDate: value || null })
  }

  const fundSummary = aggregatePortfolio(holdings, scenarioById, evalDateIso)

  return (
    <section>
      <h1>ポートフォリオ</h1>

      <div>
        <input
          placeholder="企業名"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />
        <select value={sector} onChange={(e) => setSector(e.target.value as SectorId)}>
          {SECTOR_IDS.map((id) => (
            <option key={id} value={id}>
              {SECTOR_LABELS[id]}
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="投資額(百万円)"
          value={investmentAmount}
          onChange={(e) => setInvestmentAmount(Number(e.target.value))}
        />
        <input placeholder="ラウンド" value={round} onChange={(e) => setRound(e.target.value)} />
        <input
          type="number"
          placeholder="持分(%)"
          value={ownershipPct * 100}
          onChange={(e) => setOwnershipPct(Number(e.target.value) / 100)}
        />
        <label>
          投資日
          <input type="date" value={investmentDate} onChange={(e) => setInvestmentDate(e.target.value)} />
        </label>
        <button type="button" onClick={handleAdd}>
          追加
        </button>
      </div>

      {!isLoaded ? (
        <p>読み込み中...</p>
      ) : holdings.length === 0 ? (
        <p>保有銘柄がまだありません。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>企業名</th>
              <th>セクター</th>
              <th>評価シナリオ</th>
              <th>投資日</th>
              <th>投資額(百万円)</th>
              <th>持分</th>
              <th>時価(悲観)</th>
              <th>時価(ベース)</th>
              <th>時価(楽観)</th>
              <th>MOIC</th>
              <th>IRR</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => {
              const linkedScenario = h.scenarioId ? (scenarioById.get(h.scenarioId) ?? null) : null
              const isDangling = Boolean(h.scenarioId) && !linkedScenario
              const candidateScenarios = scenarios.filter((s) => s.sector === h.sector)
              const valuation = evaluateHolding(h, linkedScenario, evalDateIso)
              return (
                <tr key={h.id}>
                  <td>{h.companyName}</td>
                  <td>{SECTOR_LABELS[h.sector]}</td>
                  <td>
                    <select value={isDangling ? '' : (h.scenarioId ?? '')} onChange={(e) => linkScenario(h, e.target.value)}>
                      <option value="">(未紐付け)</option>
                      {candidateScenarios.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    {isDangling && <span className="portfolio-page__dangling"> (削除済み)</span>}
                  </td>
                  <td>
                    <input
                      type="date"
                      value={h.investmentDate ?? ''}
                      onChange={(e) => setHoldingInvestmentDate(h, e.target.value)}
                    />
                  </td>
                  <td>{h.investmentAmount.toLocaleString('ja-JP')}</td>
                  <td>{(h.ownershipPct * 100).toFixed(1)}%</td>
                  <td>{formatMoney(valuation.marketValue.pessimistic)}</td>
                  <td>
                    {formatMoney(valuation.marketValue.base)}
                    {valuation.isCostBasis && <span className="portfolio-page__cost-badge">コスト評価</span>}
                  </td>
                  <td>{formatMoney(valuation.marketValue.optimistic)}</td>
                  <td>{formatMoic(valuation.moic)}</td>
                  <td>{formatIrr(valuation.irr, valuation.irrUnavailableReason)}</td>
                  <td>
                    <button type="button" onClick={() => removeHolding(h.id)}>
                      削除
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {isLoaded && holdings.length > 0 && (
        <section className="portfolio-page__summary">
          <h2>ファンド単位集計</h2>
          <p className="portfolio-page__summary-caption">
            評価基準日: {new Date(evalDateIso).toLocaleDateString('ja-JP')}。
            ここでの「時価総額・MOIC・IRR」は投資実績(投資日・投資額)と現在時価に基づく未実現値であり、
            シナリオ詳細の「期待IRR/MOIC」(資本政策シミュレーターのExit予測)・「含意IRR」(VC法の目標逆算)とは異なる。
            {fundSummary.hasCostBasisHoldings && ' コスト評価銘柄を含む。'}
          </p>
          <table>
            <tbody>
              <tr>
                <td>時価総額(悲観)</td>
                <td>{formatMoney(fundSummary.totalMarketValue.pessimistic)}</td>
              </tr>
              <tr>
                <td>時価総額(ベース)</td>
                <td>{formatMoney(fundSummary.totalMarketValue.base)}</td>
              </tr>
              <tr>
                <td>時価総額(楽観)</td>
                <td>{formatMoney(fundSummary.totalMarketValue.optimistic)}</td>
              </tr>
              <tr>
                <td>投資額合計</td>
                <td>{formatMoney(fundSummary.totalInvestment)}</td>
              </tr>
              <tr>
                <td>ファンドMOIC</td>
                <td>{formatMoic(fundSummary.fundMoic)}</td>
              </tr>
              <tr>
                <td>ファンドIRR</td>
                <td>{formatIrr(fundSummary.fundIrr, fundSummary.fundIrrUnavailableReason)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}
    </section>
  )
}
