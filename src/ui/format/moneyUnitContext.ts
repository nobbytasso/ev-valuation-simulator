import { createContext } from 'react'
import type { MoneyUnit } from './money.ts'

export const MONEY_UNIT_STORAGE_KEY = 'ev-valuation-simulator:money-unit'

export interface MoneyUnitContextValue {
  unit: MoneyUnit
  setUnit: (unit: MoneyUnit) => void
  toggleUnit: () => void
}

/**
 * ThemeContextとは異なりデフォルト値(百万円・no-opセッター)を持たせ、未ラップ時にthrowしない。
 * VcMethodSection/EvRangeResult等の金額表示コンポーネントは既存の単体テストがMoneyUnitProviderで
 * ラップせずrenderしており、既定単位(百万円)へのフォールバックで従来の表示を保つ(§3.1「既定 = 百万円」)。
 */
export const MoneyUnitContext = createContext<MoneyUnitContextValue>({
  unit: 'million_yen',
  setUnit: () => {},
  toggleUnit: () => {},
})
