import type { EcD2cInputs } from '../../../engine/index.ts'
import '../../sectorForm.css'

export interface EcD2cFormProps {
  inputs: EcD2cInputs
  onChange: (next: EcD2cInputs) => void
}

/** EC/D2Cドライバー入力フォーム。出典: docs/engine-spec.md §2.5 */
export function EcD2cForm({ inputs, onChange }: EcD2cFormProps) {
  const set = <K extends keyof EcD2cInputs>(key: K, value: EcD2cInputs[K]) => onChange({ ...inputs, [key]: value })
  const setMultiple = (key: 'pessimistic' | 'base' | 'optimistic', value: number) =>
    onChange({ ...inputs, evMultiple: { ...inputs.evMultiple, [key]: value } })

  return (
    <div className="sector-form">
      <label>
        年間売上(百万円)
        <input
          type="number"
          step="10"
          value={inputs.annualRevenue}
          onChange={(e) => set('annualRevenue', Number(e.target.value))}
        />
      </label>
      <label>
        売上成長率(YoY, %)
        <input
          type="number"
          step="1"
          value={inputs.revenueGrowth * 100}
          onChange={(e) => set('revenueGrowth', Number(e.target.value) / 100)}
        />
      </label>
      <label>
        粗利率(%)
        <input
          type="number"
          step="1"
          value={inputs.grossMargin * 100}
          onChange={(e) => set('grossMargin', Number(e.target.value) / 100)}
        />
      </label>
      <label>
        F2転換率(%)
        <input
          type="number"
          step="1"
          value={inputs.f2Rate * 100}
          onChange={(e) => set('f2Rate', Number(e.target.value) / 100)}
        />
      </label>
      <label>
        平均注文単価(円)
        <input type="number" step="100" value={inputs.aov} onChange={(e) => set('aov', Number(e.target.value))} />
      </label>
      <label>
        年間購入頻度(回)
        <input
          type="number"
          step="0.1"
          value={inputs.purchaseFrequency}
          onChange={(e) => set('purchaseFrequency', Number(e.target.value))}
        />
      </label>
      <label>
        CAC(円)
        <input type="number" step="100" value={inputs.cac} onChange={(e) => set('cac', Number(e.target.value))} />
      </label>
      <label>
        売上比広告費(%)
        <input
          type="number"
          step="1"
          value={inputs.adCostRatio * 100}
          onChange={(e) => set('adCostRatio', Number(e.target.value) / 100)}
        />
      </label>
      <label>
        売上比物流費(%)
        <input
          type="number"
          step="1"
          value={inputs.logisticsCostRatio * 100}
          onChange={(e) => set('logisticsCostRatio', Number(e.target.value) / 100)}
        />
      </label>
      <label>
        年間在庫回転数
        <input
          type="number"
          step="0.5"
          value={inputs.inventoryTurnover}
          onChange={(e) => set('inventoryTurnover', Number(e.target.value))}
        />
      </label>
      <label>
        マルチプル適用基準
        <select
          value={inputs.multipleBasis}
          onChange={(e) => set('multipleBasis', e.target.value as EcD2cInputs['multipleBasis'])}
        >
          <option value="revenue">EV/売上</option>
          <option value="grossProfit">EV/粗利</option>
        </select>
      </label>
      <label>
        LTV計算上限年数
        <input
          type="number"
          step="1"
          value={inputs.maxLifetimeYears}
          onChange={(e) => set('maxLifetimeYears', Number(e.target.value))}
        />
      </label>

      <fieldset className="sector-form__multiple">
        <legend>EVマルチプル(x)</legend>
        <label>
          悲観
          <input
            type="number"
            step="0.1"
            value={inputs.evMultiple.pessimistic}
            onChange={(e) => setMultiple('pessimistic', Number(e.target.value))}
          />
        </label>
        <label>
          ベース
          <input
            type="number"
            step="0.1"
            value={inputs.evMultiple.base}
            onChange={(e) => setMultiple('base', Number(e.target.value))}
          />
        </label>
        <label>
          楽観
          <input
            type="number"
            step="0.1"
            value={inputs.evMultiple.optimistic}
            onChange={(e) => setMultiple('optimistic', Number(e.target.value))}
          />
        </label>
      </fieldset>
    </div>
  )
}
