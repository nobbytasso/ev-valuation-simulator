import { ratioToPercentInput } from '../../format/percent.ts'
import type { MediaTechInputs } from '../../../engine/index.ts'
import '../../sectorForm.css'

export interface MediaTechFormProps {
  inputs: MediaTechInputs
  onChange: (next: MediaTechInputs) => void
}

/**
 * メディアテックドライバー入力フォーム。出典: docs/engine-spec.md §2.4, §0.2.1
 * min/max はエンジンのドメイン制約(§0.2.1)に対応する。
 */
export function MediaTechForm({ inputs, onChange }: MediaTechFormProps) {
  const set = <K extends keyof MediaTechInputs>(key: K, value: MediaTechInputs[K]) =>
    onChange({ ...inputs, [key]: value })
  const setArpu = (key: 'ad' | 'paid' | 'commerce', value: number) =>
    onChange({ ...inputs, arpuMonthly: { ...inputs.arpuMonthly, [key]: value } })
  const setMultiple = (key: 'pessimistic' | 'base' | 'optimistic', value: number) =>
    onChange({ ...inputs, evSalesMultiple: { ...inputs.evSalesMultiple, [key]: value } })

  return (
    <div className="sector-form">
      <label>
        MAU(人)
        <input
          type="number"
          step="1000"
          min="0"
          value={inputs.mau}
          onChange={(e) => set('mau', Number(e.target.value))}
        />
      </label>
      <label>
        MAU成長率(年率, %)
        <input
          type="number"
          step="1"
          min="-99"
          value={ratioToPercentInput(inputs.mauGrowth)}
          onChange={(e) => set('mauGrowth', Number(e.target.value) / 100)}
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
        DAU/MAU比率(%)
        <input
          type="number"
          step="1"
          min="0"
          max="100"
          value={ratioToPercentInput(inputs.dauMauRatio)}
          onChange={(e) => set('dauMauRatio', Number(e.target.value) / 100)}
        />
      </label>
      <label>
        月次解約率(%)
        <input
          type="number"
          step="0.5"
          min="0"
          max="100"
          value={ratioToPercentInput(inputs.monthlyChurn)}
          onChange={(e) => set('monthlyChurn', Number(e.target.value) / 100)}
        />
      </label>
      <label>
        コンテンツ原価率(%)
        <input
          type="number"
          step="1"
          min="0"
          max="100"
          value={ratioToPercentInput(inputs.contentCostRatio)}
          onChange={(e) => set('contentCostRatio', Number(e.target.value) / 100)}
        />
      </label>
      <label>
        CPA(円)
        <input
          type="number"
          step="10"
          min="0"
          value={inputs.cpa}
          onChange={(e) => set('cpa', Number(e.target.value))}
        />
      </label>
      <label>
        売上予測年数
        <input
          type="number"
          step="1"
          min="1"
          value={inputs.projectionYears}
          onChange={(e) => set('projectionYears', Number(e.target.value))}
        />
      </label>

      <fieldset className="sector-form__multiple">
        <legend>月次ARPU構成(円)</legend>
        <label>
          広告
          <input
            type="number"
            step="10"
            min="0"
            value={inputs.arpuMonthly.ad}
            onChange={(e) => setArpu('ad', Number(e.target.value))}
          />
        </label>
        <label>
          課金
          <input
            type="number"
            step="10"
            min="0"
            value={inputs.arpuMonthly.paid}
            onChange={(e) => setArpu('paid', Number(e.target.value))}
          />
        </label>
        <label>
          コマース
          <input
            type="number"
            step="10"
            min="0"
            value={inputs.arpuMonthly.commerce}
            onChange={(e) => setArpu('commerce', Number(e.target.value))}
          />
        </label>
      </fieldset>

      <fieldset className="sector-form__multiple">
        <legend>EV/売上マルチプル(x)</legend>
        <label>
          悲観
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={inputs.evSalesMultiple.pessimistic}
            onChange={(e) => setMultiple('pessimistic', Number(e.target.value))}
          />
        </label>
        <label>
          ベース
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={inputs.evSalesMultiple.base}
            onChange={(e) => setMultiple('base', Number(e.target.value))}
          />
        </label>
        <label>
          楽観
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={inputs.evSalesMultiple.optimistic}
            onChange={(e) => setMultiple('optimistic', Number(e.target.value))}
          />
        </label>
      </fieldset>
    </div>
  )
}
