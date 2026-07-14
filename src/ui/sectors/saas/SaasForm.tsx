import { ratioToPercentInput } from '../../format/percent.ts'
import type { SaasInputs } from '../../../engine/index.ts'
import '../../sectorForm.css'

export interface SaasFormProps {
  inputs: SaasInputs
  onChange: (next: SaasInputs) => void
}

/**
 * SaaS(日本)ドライバー入力フォーム。出典: docs/engine-spec.md §2.1, §0.2.1
 * min/max はエンジンのドメイン制約(§0.2.1)に対応する(表示単位は%のためドメインの0-1を100倍)。
 */
export function SaasForm({ inputs, onChange }: SaasFormProps) {
  const set = <K extends keyof SaasInputs>(key: K, value: SaasInputs[K]) => onChange({ ...inputs, [key]: value })
  const setMultiple = (key: 'pessimistic' | 'base' | 'optimistic', value: number) =>
    onChange({ ...inputs, evArrMultiple: { ...inputs.evArrMultiple, [key]: value } })

  return (
    <div className="sector-form">
      <label>
        ARR(百万円)
        <input
          type="number"
          step="10"
          min="0"
          value={inputs.arr}
          onChange={(e) => set('arr', Number(e.target.value))}
        />
      </label>
      <label>
        ARR成長率(YoY, %)
        <input
          type="number"
          step="1"
          min="-99"
          value={ratioToPercentInput(inputs.arrGrowth)}
          onChange={(e) => set('arrGrowth', Number(e.target.value) / 100)}
        />
      </label>
      <label>
        NRR(%)
        <input type="number" step="1" value={ratioToPercentInput(inputs.nrr)} onChange={(e) => set('nrr', Number(e.target.value) / 100)} />
      </label>
      <label>
        グロスマージン(%)
        <input
          type="number"
          step="1"
          min="0"
          max="100"
          value={ratioToPercentInput(inputs.grossMargin)}
          onChange={(e) => set('grossMargin', Number(e.target.value) / 100)}
        />
      </label>
      <label>
        営業利益率(%)
        <input
          type="number"
          step="1"
          min="-100"
          max="100"
          value={ratioToPercentInput(inputs.operatingMargin)}
          onChange={(e) => set('operatingMargin', Number(e.target.value) / 100)}
        />
      </label>
      <label>
        FCFマージン(%, 簡易DCF用)
        <input
          type="number"
          step="1"
          min="-100"
          max="100"
          value={ratioToPercentInput(inputs.fcfMargin)}
          onChange={(e) => set('fcfMargin', Number(e.target.value) / 100)}
        />
      </label>
      <label>
        年間グロスチャーン(%)
        <input
          type="number"
          step="1"
          min="0"
          max="100"
          value={ratioToPercentInput(inputs.grossChurn)}
          onChange={(e) => set('grossChurn', Number(e.target.value) / 100)}
        />
      </label>
      <label>
        CAC回収期間(月)
        <input
          type="number"
          step="1"
          min="0.1"
          value={inputs.cacPaybackMonths}
          onChange={(e) => set('cacPaybackMonths', Number(e.target.value))}
        />
      </label>
      <label>
        マルチプル適用基準
        <select value={inputs.arrBasis} onChange={(e) => set('arrBasis', e.target.value as SaasInputs['arrBasis'])}>
          <option value="ntm">NTM(来期予想)</option>
          <option value="current">実績</option>
        </select>
      </label>

      <fieldset className="sector-form__multiple">
        <legend>EV/ARRマルチプル(x)</legend>
        <label>
          悲観
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={inputs.evArrMultiple.pessimistic}
            onChange={(e) => setMultiple('pessimistic', Number(e.target.value))}
          />
        </label>
        <label>
          ベース
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={inputs.evArrMultiple.base}
            onChange={(e) => setMultiple('base', Number(e.target.value))}
          />
        </label>
        <label>
          楽観
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={inputs.evArrMultiple.optimistic}
            onChange={(e) => setMultiple('optimistic', Number(e.target.value))}
          />
        </label>
      </fieldset>

      <label>
        DCF予測年数
        <input
          type="number"
          step="1"
          min="1"
          value={inputs.projectionYears}
          onChange={(e) => set('projectionYears', Number(e.target.value))}
        />
      </label>
      <label>
        成長率減衰係数
        <input
          type="number"
          step="0.01"
          min="0.01"
          max="1"
          value={inputs.growthDecayFactor}
          onChange={(e) => set('growthDecayFactor', Number(e.target.value))}
        />
      </label>
      <label>
        割引率(DCF, %)
        <input
          type="number"
          step="0.5"
          min="0.1"
          value={ratioToPercentInput(inputs.discountRate)}
          onChange={(e) => set('discountRate', Number(e.target.value) / 100)}
        />
      </label>
      <label>
        永久成長率(%)
        <input
          type="number"
          step="0.5"
          value={ratioToPercentInput(inputs.terminalGrowth)}
          onChange={(e) => set('terminalGrowth', Number(e.target.value) / 100)}
        />
      </label>
    </div>
  )
}
