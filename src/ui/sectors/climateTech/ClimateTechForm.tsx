import type { ClimateTechInputs } from '../../../engine/index.ts'
import '../../sectorForm.css'
import './ClimateTechForm.css'

export interface ClimateTechFormProps {
  inputs: ClimateTechInputs
  onChange: (next: ClimateTechInputs) => void
}

/**
 * クライメートテックドライバー入力フォーム。出典: docs/engine-spec.md §2.6, §0.2.1
 * min/max はエンジンのドメイン制約(§0.2.1)に対応する。
 */
export function ClimateTechForm({ inputs, onChange }: ClimateTechFormProps) {
  const set = <K extends keyof ClimateTechInputs>(key: K, value: ClimateTechInputs[K]) =>
    onChange({ ...inputs, [key]: value })
  const setDiscount = (key: 'pessimistic' | 'base' | 'optimistic', value: number) =>
    onChange({ ...inputs, discountRate: { ...inputs.discountRate, [key]: value } })

  const updateCapex = (index: number, patch: Partial<{ yearIndex: number; amount: number }>) => {
    onChange({
      ...inputs,
      capexSchedule: inputs.capexSchedule.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    })
  }
  const addCapex = () => {
    const nextYear = inputs.capexSchedule.length
      ? Math.max(...inputs.capexSchedule.map((c) => c.yearIndex)) + 1
      : 0
    onChange({ ...inputs, capexSchedule: [...inputs.capexSchedule, { yearIndex: nextYear, amount: 500 }] })
  }
  const removeCapex = (index: number) => {
    onChange({ ...inputs, capexSchedule: inputs.capexSchedule.filter((_, i) => i !== index) })
  }

  return (
    <div>
      <div className="sector-form">
        <label>
          量産化マイルストーン年
          <input
            type="number"
            step="1"
            value={inputs.massProductionYear}
            onChange={(e) => set('massProductionYear', Number(e.target.value))}
          />
        </label>
        <label>
          量産化到達確率(%)
          <input
            type="number"
            step="1"
            min="0"
            max="100"
            value={inputs.massProductionProb * 100}
            onChange={(e) => set('massProductionProb', Number(e.target.value) / 100)}
          />
        </label>
        <label>
          補助金カバー率(%)
          <input
            type="number"
            step="1"
            min="0"
            max="100"
            value={inputs.subsidyCoverage * 100}
            onChange={(e) => set('subsidyCoverage', Number(e.target.value) / 100)}
          />
        </label>
        <label>
          年間生産能力(unit)
          <input
            type="number"
            step="1000"
            min="0"
            value={inputs.annualCapacityUnits}
            onChange={(e) => set('annualCapacityUnits', Number(e.target.value))}
          />
        </label>
        <label>
          フル稼働までの年数
          <input
            type="number"
            step="1"
            min="1"
            value={inputs.rampYears}
            onChange={(e) => set('rampYears', Number(e.target.value))}
          />
        </label>
        <label>
          販売単価(円/unit)
          <input
            type="number"
            step="100"
            min="0"
            value={inputs.unitPrice}
            onChange={(e) => set('unitPrice', Number(e.target.value))}
          />
        </label>
        <label>
          現在のユニットコスト(円/unit)
          <input
            type="number"
            step="100"
            min="0"
            value={inputs.unitCost0}
            onChange={(e) => set('unitCost0', Number(e.target.value))}
          />
        </label>
        <label>
          ユニットコスト年次低減率(%)
          <input
            type="number"
            step="1"
            min="0"
            max="99.9"
            value={inputs.costDeclineRate * 100}
            onChange={(e) => set('costDeclineRate', Number(e.target.value) / 100)}
          />
        </label>
        <label>
          オフテイク契約カバー率(%)
          <input
            type="number"
            step="1"
            min="0"
            max="100"
            value={inputs.offtakeCoverage * 100}
            onChange={(e) => set('offtakeCoverage', Number(e.target.value) / 100)}
          />
        </label>
        <label>
          非オフテイク分の販売実現率(%)
          <input
            type="number"
            step="1"
            min="0"
            max="100"
            value={inputs.merchantRealization * 100}
            onChange={(e) => set('merchantRealization', Number(e.target.value) / 100)}
          />
        </label>
        <label>
          量産後の年間固定費(百万円)
          <input
            type="number"
            step="10"
            min="0"
            value={inputs.fixedOpexAnnual}
            onChange={(e) => set('fixedOpexAnnual', Number(e.target.value))}
          />
        </label>
        <label>
          カーボンクレジット量(t-CO2/年)
          <input
            type="number"
            step="1000"
            min="0"
            value={inputs.carbonCreditVolume}
            onChange={(e) => set('carbonCreditVolume', Number(e.target.value))}
          />
        </label>
        <label>
          カーボンクレジット価格(円/t-CO2)
          <input
            type="number"
            step="100"
            min="0"
            value={inputs.carbonCreditPrice}
            onChange={(e) => set('carbonCreditPrice', Number(e.target.value))}
          />
        </label>
        <label>
          プロジェクト評価年数
          <input
            type="number"
            step="1"
            min="1"
            value={inputs.projectYears}
            onChange={(e) => set('projectYears', Number(e.target.value))}
          />
        </label>
      </div>

      <fieldset className="sector-form__multiple">
        <legend>割引率(%)</legend>
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

      <div className="climate-tech-form__capex">
        <h3>CAPEXスケジュール</h3>
        <table>
          <thead>
            <tr>
              <th>年</th>
              <th>金額(百万円)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {inputs.capexSchedule.map((c, i) => (
              <tr key={i}>
                <td>
                  <label>
                    年
                    <input
                      type="number"
                      step="1"
                      value={c.yearIndex}
                      onChange={(e) => updateCapex(i, { yearIndex: Number(e.target.value) })}
                    />
                  </label>
                </td>
                <td>
                  <label>
                    金額(百万円)
                    <input
                      type="number"
                      step="100"
                      min="0"
                      value={c.amount}
                      onChange={(e) => updateCapex(i, { amount: Number(e.target.value) })}
                    />
                  </label>
                </td>
                <td>
                  <button type="button" onClick={() => removeCapex(i)}>
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={addCapex}>
          ＋ CAPEXを追加
        </button>
      </div>
    </div>
  )
}
