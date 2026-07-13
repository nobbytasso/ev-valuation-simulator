import type { DeviceClass, MedicalDeviceInputs } from '../../../engine/index.ts'
import '../../sectorForm.css'

export interface MedicalDeviceFormProps {
  inputs: MedicalDeviceInputs
  onChange: (next: MedicalDeviceInputs) => void
}

const DEVICE_CLASSES: DeviceClass[] = ['I', 'II', 'III', 'IV']

/**
 * 医療機器ドライバー入力フォーム。出典: docs/engine-spec.md §2.3, §0.2.1
 * min/max はエンジンのドメイン制約(§0.2.1)に対応する。
 */
export function MedicalDeviceForm({ inputs, onChange }: MedicalDeviceFormProps) {
  const set = <K extends keyof MedicalDeviceInputs>(key: K, value: MedicalDeviceInputs[K]) =>
    onChange({ ...inputs, [key]: value })
  const setDiscount = (key: 'pessimistic' | 'base' | 'optimistic', value: number) =>
    onChange({ ...inputs, discountRate: { ...inputs.discountRate, [key]: value } })

  return (
    <div className="sector-form">
      <label>
        年間対象手技数
        <input
          type="number"
          step="100"
          min="0"
          value={inputs.annualProcedures}
          onChange={(e) => set('annualProcedures', Number(e.target.value))}
        />
      </label>
      <label>
        手技数成長率(年率, %)
        <input
          type="number"
          step="1"
          min="-99"
          value={inputs.procedureGrowth * 100}
          onChange={(e) => set('procedureGrowth', Number(e.target.value) / 100)}
        />
      </label>
      <label>
        クラス分類
        <select value={inputs.deviceClass} onChange={(e) => set('deviceClass', e.target.value as DeviceClass)}>
          {DEVICE_CLASSES.map((c) => (
            <option key={c} value={c}>
              Class {c}
            </option>
          ))}
        </select>
      </label>
      <label>
        上市年(承認+償還完了)
        <input
          type="number"
          step="1"
          value={inputs.launchYear}
          onChange={(e) => set('launchYear', Number(e.target.value))}
        />
      </label>
      <label>
        承認遅延年数
        <input
          type="number"
          step="1"
          min="0"
          value={inputs.approvalDelayYears}
          onChange={(e) => set('approvalDelayYears', Number(e.target.value))}
        />
      </label>
      <label>
        手技あたり単価(円、償還ベース)
        <input
          type="number"
          step="1000"
          min="0"
          value={inputs.pricePerProcedure}
          onChange={(e) => set('pricePerProcedure', Number(e.target.value))}
        />
      </label>
      <label>
        最大浸透率(%)
        <input
          type="number"
          step="1"
          min="0"
          max="100"
          value={inputs.peakPenetration * 100}
          onChange={(e) => set('peakPenetration', Number(e.target.value) / 100)}
        />
      </label>
      <label>
        浸透ランプ年数
        <input
          type="number"
          step="1"
          min="1"
          value={inputs.yearsToPeak}
          onChange={(e) => set('yearsToPeak', Number(e.target.value))}
        />
      </label>
      <label>
        リカーリング比率(%)
        <input
          type="number"
          step="1"
          min="0"
          max="99.9"
          value={inputs.recurringRatio * 100}
          onChange={(e) => set('recurringRatio', Number(e.target.value) / 100)}
        />
      </label>
      <label>
        定常営業利益率(%)
        <input
          type="number"
          step="1"
          value={inputs.operatingMargin * 100}
          onChange={(e) => set('operatingMargin', Number(e.target.value) / 100)}
        />
      </label>
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
        永久成長率(%)
        <input
          type="number"
          step="0.5"
          value={inputs.terminalGrowth * 100}
          onChange={(e) => set('terminalGrowth', Number(e.target.value) / 100)}
        />
      </label>

      <fieldset className="sector-form__multiple">
        <legend>割引率(DCF, %)</legend>
        <label>
          悲観
          <input
            type="number"
            step="0.5"
            min="0.1"
            value={inputs.discountRate.pessimistic * 100}
            onChange={(e) => setDiscount('pessimistic', Number(e.target.value) / 100)}
          />
        </label>
        <label>
          ベース
          <input
            type="number"
            step="0.5"
            min="0.1"
            value={inputs.discountRate.base * 100}
            onChange={(e) => setDiscount('base', Number(e.target.value) / 100)}
          />
        </label>
        <label>
          楽観
          <input
            type="number"
            step="0.5"
            min="0.1"
            value={inputs.discountRate.optimistic * 100}
            onChange={(e) => setDiscount('optimistic', Number(e.target.value) / 100)}
          />
        </label>
      </fieldset>
    </div>
  )
}
