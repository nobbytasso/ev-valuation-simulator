import type { SaasInputs } from '../../../engine/index.ts'
import './SaasForm.css'

export interface SaasFormProps {
  inputs: SaasInputs
  onChange: (next: SaasInputs) => void
}

/** SaaS(日本)ドライバー入力フォーム。出典: docs/engine-spec.md §2.1 */
export function SaasForm({ inputs, onChange }: SaasFormProps) {
  const set = <K extends keyof SaasInputs>(key: K, value: SaasInputs[K]) => onChange({ ...inputs, [key]: value })
  const setMultiple = (key: 'pessimistic' | 'base' | 'optimistic', value: number) =>
    onChange({ ...inputs, evArrMultiple: { ...inputs.evArrMultiple, [key]: value } })

  return (
    <div className="saas-form">
      <label>
        ARR(百万円)
        <input type="number" step="10" value={inputs.arr} onChange={(e) => set('arr', Number(e.target.value))} />
      </label>
      <label>
        ARR成長率(YoY, %)
        <input
          type="number"
          step="1"
          value={inputs.arrGrowth * 100}
          onChange={(e) => set('arrGrowth', Number(e.target.value) / 100)}
        />
      </label>
      <label>
        NRR(%)
        <input type="number" step="1" value={inputs.nrr * 100} onChange={(e) => set('nrr', Number(e.target.value) / 100)} />
      </label>
      <label>
        グロスマージン(%)
        <input
          type="number"
          step="1"
          value={inputs.grossMargin * 100}
          onChange={(e) => set('grossMargin', Number(e.target.value) / 100)}
        />
      </label>
      <label>
        営業利益率(%)
        <input
          type="number"
          step="1"
          value={inputs.operatingMargin * 100}
          onChange={(e) => set('operatingMargin', Number(e.target.value) / 100)}
        />
      </label>
      <label>
        FCFマージン(%, 簡易DCF用)
        <input
          type="number"
          step="1"
          value={inputs.fcfMargin * 100}
          onChange={(e) => set('fcfMargin', Number(e.target.value) / 100)}
        />
      </label>
      <label>
        年間グロスチャーン(%)
        <input
          type="number"
          step="1"
          value={inputs.grossChurn * 100}
          onChange={(e) => set('grossChurn', Number(e.target.value) / 100)}
        />
      </label>
      <label>
        CAC回収期間(月)
        <input
          type="number"
          step="1"
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

      <fieldset className="saas-form__multiple">
        <legend>EV/ARRマルチプル(x)</legend>
        <label>
          悲観
          <input
            type="number"
            step="0.1"
            value={inputs.evArrMultiple.pessimistic}
            onChange={(e) => setMultiple('pessimistic', Number(e.target.value))}
          />
        </label>
        <label>
          ベース
          <input
            type="number"
            step="0.1"
            value={inputs.evArrMultiple.base}
            onChange={(e) => setMultiple('base', Number(e.target.value))}
          />
        </label>
        <label>
          楽観
          <input
            type="number"
            step="0.1"
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
          value={inputs.projectionYears}
          onChange={(e) => set('projectionYears', Number(e.target.value))}
        />
      </label>
      <label>
        成長率減衰係数
        <input
          type="number"
          step="0.01"
          value={inputs.growthDecayFactor}
          onChange={(e) => set('growthDecayFactor', Number(e.target.value))}
        />
      </label>
      <label>
        割引率(DCF, %)
        <input
          type="number"
          step="0.5"
          value={inputs.discountRate * 100}
          onChange={(e) => set('discountRate', Number(e.target.value) / 100)}
        />
      </label>
      <label>
        永久成長率(%)
        <input
          type="number"
          step="0.5"
          value={inputs.terminalGrowth * 100}
          onChange={(e) => set('terminalGrowth', Number(e.target.value) / 100)}
        />
      </label>
    </div>
  )
}
