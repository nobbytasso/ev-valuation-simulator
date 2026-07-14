/**
 * SaaS入力フィールドのラベル表(Excel前提条件シート用)。出典: docs/phase5-spec.md §1.2-2
 * 文言は SaasForm.tsx の実ラベルと一致させる。
 */
import type { SectorFieldLabelTable } from '../../scenarioEvaluation/fieldLabelTypes.ts'

export const SAAS_FIELD_LABELS: SectorFieldLabelTable = {
  scalars: {
    arr: { label: '現在ARR', format: 'money', unit: '百万円' },
    arrGrowth: { label: 'ARR成長率(YoY)', format: 'ratio', unit: '%' },
    nrr: { label: 'NRR', format: 'ratio', unit: '%' },
    grossMargin: { label: 'グロスマージン', format: 'ratio', unit: '%' },
    operatingMargin: { label: '営業利益率', format: 'ratio', unit: '%' },
    fcfMargin: { label: 'FCFマージン(簡易DCF用)', format: 'ratio', unit: '%' },
    grossChurn: { label: '年間グロスチャーン', format: 'ratio', unit: '%' },
    cacPaybackMonths: { label: 'CAC回収期間', format: 'number', unit: '月' },
    arrBasis: { label: 'マルチプル適用基準', format: 'select', unit: '' },
    'evArrMultiple.pessimistic': { label: 'EV/ARRマルチプル(悲観)', format: 'number', unit: 'x' },
    'evArrMultiple.base': { label: 'EV/ARRマルチプル(ベース)', format: 'number', unit: 'x' },
    'evArrMultiple.optimistic': { label: 'EV/ARRマルチプル(楽観)', format: 'number', unit: 'x' },
    projectionYears: { label: 'DCF予測年数', format: 'number', unit: '年' },
    growthDecayFactor: { label: '成長率減衰係数', format: 'number', unit: '' },
    discountRate: { label: '割引率(DCF)', format: 'ratio', unit: '%' },
    terminalGrowth: { label: '永久成長率', format: 'ratio', unit: '%' },
  },
  arrays: {},
}
