import { moneyUnitLabel } from './format/money.ts'
import { useMoneyUnit } from './format/useMoneyUnit.ts'

/** ヘッダーの金額単位トグル(百万円/億円)。ThemeToggleと並置(出典: docs/phase6-spec.md §3.1)。 */
export function MoneyUnitToggle() {
  const { unit, toggleUnit } = useMoneyUnit()
  return (
    <button type="button" onClick={toggleUnit} aria-label="金額単位切替">
      表示単位: {moneyUnitLabel(unit)}
    </button>
  )
}
