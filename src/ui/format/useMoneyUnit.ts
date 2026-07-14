import { useContext } from 'react'
import { MoneyUnitContext } from './moneyUnitContext.ts'
import type { MoneyUnitContextValue } from './moneyUnitContext.ts'

export function useMoneyUnit(): MoneyUnitContextValue {
  return useContext(MoneyUnitContext)
}
