import { useEffect, useState } from 'react'
import { usePortfolioStore } from '../store/portfolioStore.ts'
import { SECTOR_IDS, SECTOR_LABELS } from '../store/scenarioTypes.ts'
import type { SectorId } from '../store/scenarioTypes.ts'

/**
 * 仮想ポートフォリオ管理の仮画面。ファンド単位集計(IRR/MOIC)はPhase 5で追加。
 * 出典: docs/requirements-rev4.md §4.1.3
 */
export function PortfolioPage() {
  const { holdings, isLoaded, loadAll, addHolding, removeHolding } = usePortfolioStore()
  const [companyName, setCompanyName] = useState('')
  const [sector, setSector] = useState<SectorId>('saas_jp')
  const [investmentAmount, setInvestmentAmount] = useState(0)
  const [round, setRound] = useState('シリーズA')
  const [ownershipPct, setOwnershipPct] = useState(0)

  useEffect(() => {
    if (!isLoaded) void loadAll()
  }, [isLoaded, loadAll])

  const handleAdd = async () => {
    if (!companyName) return
    await addHolding({ companyName, sector, investmentAmount, round, ownershipPct })
    setCompanyName('')
    setInvestmentAmount(0)
    setOwnershipPct(0)
  }

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
              <th>投資額(百万円)</th>
              <th>ラウンド</th>
              <th>持分</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => (
              <tr key={h.id}>
                <td>{h.companyName}</td>
                <td>{SECTOR_LABELS[h.sector]}</td>
                <td>{h.investmentAmount.toLocaleString('ja-JP')}</td>
                <td>{h.round}</td>
                <td>{(h.ownershipPct * 100).toFixed(1)}%</td>
                <td>
                  <button type="button" onClick={() => removeHolding(h.id)}>
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
