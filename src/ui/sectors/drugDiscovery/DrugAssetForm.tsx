import { PHASE_ORDER } from '../../../engine/index.ts'
import type { Phase, PipelineAsset } from '../../../engine/index.ts'
import { useStableListKeys } from '../../useStableListKeys.ts'
import { PHASE_LABELS } from './phaseLabels.ts'
import '../../sectorForm.css'
import './DrugAssetForm.css'

export interface DrugAssetFormProps {
  asset: PipelineAsset
  onChange: (next: PipelineAsset) => void
  onRemove: () => void
  canRemove: boolean
}

/**
 * パイプライン品目1件分の入力フォーム。出典: docs/engine-spec.md §2.2
 * フェーズ確率・所要年数・開発費は5フェーズ全て常時表示する(現フェーズより前のフェーズは
 * 計算に使われないが、品目のcurrentPhase変更時に値を保持できるようUI上は常時編集可能とする)。
 */
export function DrugAssetForm({ asset, onChange, onRemove, canRemove }: DrugAssetFormProps) {
  const milestoneKeys = useStableListKeys(
    asset.commercialization.type === 'license' ? asset.commercialization.milestones.length : 0,
  )
  const set = <K extends keyof PipelineAsset>(key: K, value: PipelineAsset[K]) => onChange({ ...asset, [key]: value })
  // マイルストーンは残フェーズ(現フェーズ以降)+上市時のみ選択可(C-6)。
  // 現フェーズより前を選択すると、エンジンは「既に到達済み」としてt=0・確率1で計上する
  // 未定義動作(TODOコメント参照)に陥るため、UI側で意味論の穴を塞ぐ。
  const milestonePhaseOptions: (Phase | 'launch')[] = [...PHASE_ORDER.slice(PHASE_ORDER.indexOf(asset.currentPhase)), 'launch']
  const setPhaseField = (
    field: 'phaseSuccessProbs' | 'phaseDurations' | 'developmentCosts',
    phase: Phase,
    value: number,
  ) => onChange({ ...asset, [field]: { ...asset[field], [phase]: value } })

  const setCommercializationType = (type: 'own' | 'license') => {
    if (type === 'own') {
      onChange({ ...asset, commercialization: { type: 'own', contributionMargin: 0.6 } })
    } else {
      onChange({ ...asset, commercialization: { type: 'license', royaltyRate: 0.12, milestones: [] } })
    }
  }

  const addMilestone = () => {
    if (asset.commercialization.type !== 'license') return
    onChange({
      ...asset,
      commercialization: {
        ...asset.commercialization,
        milestones: [...asset.commercialization.milestones, { phase: 'launch', amount: 500 }],
      },
    })
    milestoneKeys.push()
  }
  const updateMilestone = (index: number, patch: Partial<{ phase: Phase | 'launch'; amount: number }>) => {
    if (asset.commercialization.type !== 'license') return
    const milestones = asset.commercialization.milestones.map((m, i) => (i === index ? { ...m, ...patch } : m))
    onChange({ ...asset, commercialization: { ...asset.commercialization, milestones } })
  }
  const removeMilestone = (index: number) => {
    if (asset.commercialization.type !== 'license') return
    const milestones = asset.commercialization.milestones.filter((_, i) => i !== index)
    onChange({ ...asset, commercialization: { ...asset.commercialization, milestones } })
    milestoneKeys.removeAt(index)
  }

  return (
    <div className="drug-asset-form">
      <div className="drug-asset-form__header">
        <label>
          品目名
          <input type="text" value={asset.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label>
          現在のフェーズ
          <select value={asset.currentPhase} onChange={(e) => set('currentPhase', e.target.value as Phase)}>
            {PHASE_ORDER.map((p) => (
              <option key={p} value={p}>
                {PHASE_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onRemove} disabled={!canRemove}>
          この品目を削除
        </button>
      </div>

      <table className="drug-asset-form__phase-table">
        <thead>
          <tr>
            <th>フェーズ</th>
            <th>成功確率(%)</th>
            <th>所要年数</th>
            <th>開発費(百万円)</th>
          </tr>
        </thead>
        <tbody>
          {PHASE_ORDER.map((p) => (
            <tr key={p}>
              <td>{PHASE_LABELS[p]}</td>
              <td>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={asset.phaseSuccessProbs[p] * 100}
                  onChange={(e) => setPhaseField('phaseSuccessProbs', p, Number(e.target.value) / 100)}
                />
              </td>
              <td>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={asset.phaseDurations[p]}
                  onChange={(e) => setPhaseField('phaseDurations', p, Number(e.target.value))}
                />
              </td>
              <td>
                <input
                  type="number"
                  step="100"
                  min="0"
                  value={asset.developmentCosts[p]}
                  onChange={(e) => setPhaseField('developmentCosts', p, Number(e.target.value))}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="sector-form">
        <label>
          上市年(現在からの年数)
          <input type="number" step="1" value={asset.launchYear} onChange={(e) => set('launchYear', Number(e.target.value))} />
        </label>
        <label>
          ピーク売上(百万円)
          <input
            type="number"
            step="100"
            min="0"
            value={asset.peakSales}
            onChange={(e) => set('peakSales', Number(e.target.value))}
          />
        </label>
        <label>
          ピーク到達年数
          <input
            type="number"
            step="1"
            min="1"
            value={asset.yearsToPeak}
            onChange={(e) => set('yearsToPeak', Number(e.target.value))}
          />
        </label>
        <label>
          ピーク維持年数
          <input
            type="number"
            step="1"
            min="0"
            value={asset.plateauYears}
            onChange={(e) => set('plateauYears', Number(e.target.value))}
          />
        </label>
        <label>
          特許切れ後の年次減衰率(%)
          <input
            type="number"
            step="1"
            min="0"
            max="100"
            value={asset.declineRate * 100}
            onChange={(e) => set('declineRate', Number(e.target.value) / 100)}
          />
        </label>
        <label>
          販売方式
          <select
            value={asset.commercialization.type}
            onChange={(e) => setCommercializationType(e.target.value as 'own' | 'license')}
          >
            <option value="own">自社販売</option>
            <option value="license">導出(ロイヤリティ)</option>
          </select>
        </label>
        {asset.commercialization.type === 'own' ? (
          <label>
            貢献利益率(%)
            <input
              type="number"
              step="1"
              value={asset.commercialization.contributionMargin * 100}
              onChange={(e) =>
                onChange({
                  ...asset,
                  commercialization: { type: 'own', contributionMargin: Number(e.target.value) / 100 },
                })
              }
            />
          </label>
        ) : (
          <label>
            ロイヤリティ率(%)
            <input
              type="number"
              step="1"
              value={asset.commercialization.royaltyRate * 100}
              onChange={(e) => {
                if (asset.commercialization.type !== 'license') return
                onChange({
                  ...asset,
                  commercialization: { ...asset.commercialization, royaltyRate: Number(e.target.value) / 100 },
                })
              }}
            />
          </label>
        )}
      </div>

      {asset.commercialization.type === 'license' && (
        <div className="drug-asset-form__milestones">
          <h4>マイルストーン</h4>
          {asset.commercialization.milestones.map((m, i) => (
            <div key={milestoneKeys.keys[i] ?? String(i)} className="drug-asset-form__milestone-row">
              <label>
                発生タイミング
                <select value={m.phase} onChange={(e) => updateMilestone(i, { phase: e.target.value as Phase | 'launch' })}>
                  {milestonePhaseOptions.map((p) => (
                    <option key={p} value={p}>
                      {p === 'launch' ? '上市時' : `${PHASE_LABELS[p]}完了時`}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                金額(百万円)
                <input
                  type="number"
                  step="100"
                  value={m.amount}
                  onChange={(e) => updateMilestone(i, { amount: Number(e.target.value) })}
                />
              </label>
              <button type="button" onClick={() => removeMilestone(i)}>
                削除
              </button>
            </div>
          ))}
          <button type="button" onClick={addMilestone}>
            ＋ マイルストーンを追加
          </button>
        </div>
      )}
    </div>
  )
}
