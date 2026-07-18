import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { StaticJsonSource } from '../adapters/benchmarks/StaticJsonSource.ts'
import { SECTOR_IDS } from '../store/scenarioTypes.ts'
import { DummyDataBadge } from './DummyDataBadge.tsx'
import { MoneyUnitToggle } from './MoneyUnitToggle.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'

function useHasDummyBenchmarkData(): boolean {
  const [hasDummyData, setHasDummyData] = useState(false)
  useEffect(() => {
    const source = new StaticJsonSource()
    let cancelled = false
    void Promise.all(SECTOR_IDS.map((id) => source.fetchSector(id))).then((results) => {
      if (cancelled) return
      setHasDummyData(results.some((data) => data?.data_status === 'dummy'))
    })
    return () => {
      cancelled = true
    }
  }, [])
  return hasDummyData
}

export function Header() {
  const hasDummyData = useHasDummyBenchmarkData()
  return (
    <header className="app-header">
      <div className="app-header__brand">
        VC Valuation Simulator
        {hasDummyData && <DummyDataBadge />}
      </div>
      <nav className="app-header__nav">
        <NavLink to="/" end>
          投資ケース
        </NavLink>
        <NavLink to="/legacy">旧シナリオ</NavLink>
        <NavLink to="/portfolio">ポートフォリオ</NavLink>
      </nav>
      <MoneyUnitToggle />
      <ThemeToggle />
    </header>
  )
}
