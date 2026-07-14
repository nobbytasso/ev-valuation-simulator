/**
 * 金額表示単位の切替+永続化。出典: docs/phase6-spec.md §3.1、P6-1裁定。
 * 選択はlocalStorageに永続化。既定は百万円(表示系のみ切替対象。入力フォーム・Excelは百万円固定)。
 */
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { MoneyUnit } from './money.ts'
import { MONEY_UNIT_STORAGE_KEY, MoneyUnitContext } from './moneyUnitContext.ts'

function readStoredUnit(): MoneyUnit {
  if (typeof window === 'undefined') return 'million_yen'
  const stored = window.localStorage.getItem(MONEY_UNIT_STORAGE_KEY)
  return stored === 'oku_yen' ? 'oku_yen' : 'million_yen'
}

export function MoneyUnitProvider({ children }: { children: ReactNode }) {
  const [unit, setUnitState] = useState<MoneyUnit>(readStoredUnit)

  useEffect(() => {
    window.localStorage.setItem(MONEY_UNIT_STORAGE_KEY, unit)
  }, [unit])

  const setUnit = useCallback((next: MoneyUnit) => setUnitState(next), [])
  const toggleUnit = useCallback(() => setUnitState((prev) => (prev === 'million_yen' ? 'oku_yen' : 'million_yen')), [])

  return <MoneyUnitContext.Provider value={{ unit, setUnit, toggleUnit }}>{children}</MoneyUnitContext.Provider>
}
