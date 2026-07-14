/**
 * 創薬入力フィールドのラベル表(Excel前提条件シート用)。出典: docs/phase5-spec.md §1.2-2
 * 文言は DrugDiscoveryForm.tsx / DrugAssetForm.tsx の実ラベルと一致させる。
 * assets[] は「品目ブロック」(品目名見出し+品目内フィールド)として展開する(assetBlock、§1.2-2)。
 *
 * 品目内の commercialization.milestones[](導出時のみ・任意項目)はさらに一段ネストした配列であり、
 * 本ラベル表の対象外とする。Excel生成(C6)では PHASE_LABELS と「金額(百万円)」表記を直接使って
 * 展開する(milestones は疎で構造も薄いため、独立したラベルエントリを設けるほどの複雑性がない
 * という実装判断。仕様上の不確実性ではないためTODO化はしない)。
 */
import { PHASE_ORDER } from '../../../engine/index.ts'
import type { FieldLabelEntry, SectorFieldLabelTable } from '../../scenarioEvaluation/fieldLabelTypes.ts'
import { PHASE_LABELS } from './phaseLabels.ts'

function phaseFields(): Record<string, FieldLabelEntry> {
  const fields: Record<string, FieldLabelEntry> = {}
  for (const phase of PHASE_ORDER) {
    fields[`phaseSuccessProbs.${phase}`] = { label: `成功確率(${PHASE_LABELS[phase]})`, format: 'ratio', unit: '%' }
    fields[`phaseDurations.${phase}`] = { label: `所要年数(${PHASE_LABELS[phase]})`, format: 'number', unit: '年' }
    fields[`developmentCosts.${phase}`] = { label: `開発費(${PHASE_LABELS[phase]})`, format: 'money', unit: '百万円' }
  }
  return fields
}

export const DRUG_DISCOVERY_FIELD_LABELS: SectorFieldLabelTable = {
  scalars: {
    'discountRate.pessimistic': { label: '割引率(悲観)', format: 'ratio', unit: '%' },
    'discountRate.base': { label: '割引率(ベース)', format: 'ratio', unit: '%' },
    'discountRate.optimistic': { label: '割引率(楽観)', format: 'ratio', unit: '%' },
    modelHorizonYears: { label: '評価ホライズン(上市後年数)', format: 'number', unit: '年' },
  },
  arrays: {
    assets: {
      kind: 'assetBlock',
      itemFields: {
        name: { label: '品目名', format: 'text', unit: '' },
        currentPhase: { label: '現在のフェーズ', format: 'select', unit: '' },
        ...phaseFields(),
        launchYear: { label: '上市年(現在からの年数)', format: 'number', unit: '年' },
        peakSales: { label: 'ピーク売上', format: 'money', unit: '百万円' },
        yearsToPeak: { label: 'ピーク到達年数', format: 'number', unit: '年' },
        plateauYears: { label: 'ピーク維持年数', format: 'number', unit: '年' },
        declineRate: { label: '特許切れ後の年次減衰率', format: 'ratio', unit: '%' },
        'commercialization.type': { label: '販売方式', format: 'select', unit: '' },
        'commercialization.contributionMargin': { label: '貢献利益率(自社販売時)', format: 'ratio', unit: '%' },
        'commercialization.royaltyRate': { label: 'ロイヤリティ率(導出時)', format: 'ratio', unit: '%' },
      },
    },
  },
}
