/**
 * メディアテック入力フィールドのラベル表(Excel前提条件シート用)。出典: docs/phase5-spec.md §1.2-2
 * 文言は MediaTechForm.tsx の実ラベルと一致させる。
 */
import type { SectorFieldLabelTable } from '../../scenarioEvaluation/fieldLabelTypes.ts'

export const MEDIA_TECH_FIELD_LABELS: SectorFieldLabelTable = {
  scalars: {
    mau: { label: 'MAU', format: 'number', unit: '人' },
    mauGrowth: { label: 'MAU成長率(年率)', format: 'ratio', unit: '%' },
    growthDecayFactor: { label: '成長率減衰係数', format: 'number', unit: '' },
    dauMauRatio: { label: 'DAU/MAU比率', format: 'ratio', unit: '%' },
    'arpuMonthly.ad': { label: '月次ARPU(広告)', format: 'yen', unit: '円' },
    'arpuMonthly.paid': { label: '月次ARPU(課金)', format: 'yen', unit: '円' },
    'arpuMonthly.commerce': { label: '月次ARPU(コマース)', format: 'yen', unit: '円' },
    monthlyChurn: { label: '月次解約率', format: 'ratio', unit: '%' },
    contentCostRatio: { label: 'コンテンツ原価率', format: 'ratio', unit: '%' },
    cpa: { label: 'CPA', format: 'yen', unit: '円' },
    'evSalesMultiple.pessimistic': { label: 'EV/売上マルチプル(悲観)', format: 'number', unit: 'x' },
    'evSalesMultiple.base': { label: 'EV/売上マルチプル(ベース)', format: 'number', unit: 'x' },
    'evSalesMultiple.optimistic': { label: 'EV/売上マルチプル(楽観)', format: 'number', unit: 'x' },
    projectionYears: { label: '売上予測年数', format: 'number', unit: '年' },
  },
  arrays: {},
}
