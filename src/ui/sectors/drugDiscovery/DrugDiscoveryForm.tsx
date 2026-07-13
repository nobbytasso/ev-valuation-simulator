import type { DrugDiscoveryInputs, PipelineAsset } from '../../../engine/index.ts'
import '../../sectorForm.css'
import { DrugAssetForm } from './DrugAssetForm.tsx'

export interface DrugDiscoveryFormProps {
  inputs: DrugDiscoveryInputs
  onChange: (next: DrugDiscoveryInputs) => void
}

function createDefaultAsset(name: string): PipelineAsset {
  return {
    name,
    currentPhase: 'preclinical',
    phaseSuccessProbs: { preclinical: 0.5, phase1: 0.5, phase2: 0.3, phase3: 0.6, filing: 0.85 },
    phaseDurations: { preclinical: 2, phase1: 2, phase2: 2, phase3: 3, filing: 1 },
    developmentCosts: { preclinical: 400, phase1: 900, phase2: 2000, phase3: 5000, filing: 400 },
    launchYear: 10,
    peakSales: 2000,
    yearsToPeak: 3,
    plateauYears: 3,
    declineRate: 0.1,
    commercialization: { type: 'own', contributionMargin: 0.6 },
  }
}

/** 創薬(パイプライン)入力フォーム。出典: docs/engine-spec.md §2.2 */
export function DrugDiscoveryForm({ inputs, onChange }: DrugDiscoveryFormProps) {
  const setDiscount = (key: 'pessimistic' | 'base' | 'optimistic', value: number) =>
    onChange({ ...inputs, discountRate: { ...inputs.discountRate, [key]: value } })

  const updateAsset = (index: number, next: PipelineAsset) => {
    onChange({ ...inputs, assets: inputs.assets.map((a, i) => (i === index ? next : a)) })
  }
  const removeAsset = (index: number) => {
    onChange({ ...inputs, assets: inputs.assets.filter((_, i) => i !== index) })
  }
  const addAsset = () => {
    onChange({ ...inputs, assets: [...inputs.assets, createDefaultAsset(`品目${inputs.assets.length + 1}`)] })
  }

  return (
    <div>
      <div className="sector-form">
        <label>
          評価ホライズン(上市後年数)
          <input
            type="number"
            step="1"
            value={inputs.modelHorizonYears}
            onChange={(e) => onChange({ ...inputs, modelHorizonYears: Number(e.target.value) })}
          />
        </label>
        <fieldset className="sector-form__multiple">
          <legend>割引率(%)</legend>
          <label>
            悲観
            <input
              type="number"
              step="0.5"
              value={inputs.discountRate.pessimistic * 100}
              onChange={(e) => setDiscount('pessimistic', Number(e.target.value) / 100)}
            />
          </label>
          <label>
            ベース
            <input
              type="number"
              step="0.5"
              value={inputs.discountRate.base * 100}
              onChange={(e) => setDiscount('base', Number(e.target.value) / 100)}
            />
          </label>
          <label>
            楽観
            <input
              type="number"
              step="0.5"
              value={inputs.discountRate.optimistic * 100}
              onChange={(e) => setDiscount('optimistic', Number(e.target.value) / 100)}
            />
          </label>
        </fieldset>
      </div>

      <h3>パイプライン品目</h3>
      {inputs.assets.map((asset, i) => (
        <DrugAssetForm
          key={i}
          asset={asset}
          onChange={(next) => updateAsset(i, next)}
          onRemove={() => removeAsset(i)}
          canRemove={inputs.assets.length > 1}
        />
      ))}
      <button type="button" onClick={addAsset}>
        ＋ 品目を追加
      </button>
    </div>
  )
}
