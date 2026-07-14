/**
 * EC/D2C入力フィールドのラベル表(Excel前提条件シート用)。出典: docs/phase5-spec.md §1.2-2
 * 文言は EcD2cForm.tsx の実ラベルと一致させる。
 */
import type { SectorFieldLabelTable } from '../../scenarioEvaluation/fieldLabelTypes.ts'

export const EC_D2C_FIELD_LABELS: SectorFieldLabelTable = {
  scalars: {
    annualRevenue: { label: '年間売上', format: 'money', unit: '百万円' },
    revenueGrowth: { label: '売上成長率(YoY)', format: 'ratio', unit: '%' },
    grossMargin: { label: '粗利率', format: 'ratio', unit: '%' },
    f2Rate: { label: 'F2転換率', format: 'ratio', unit: '%' },
    aov: { label: '平均注文単価', format: 'yen', unit: '円' },
    purchaseFrequency: { label: '年間購入頻度', format: 'number', unit: '回' },
    cac: { label: 'CAC', format: 'yen', unit: '円' },
    adCostRatio: { label: '売上比広告費', format: 'ratio', unit: '%' },
    logisticsCostRatio: { label: '売上比物流費', format: 'ratio', unit: '%' },
    inventoryTurnover: { label: '年間在庫回転数', format: 'number', unit: '回' },
    multipleBasis: { label: 'マルチプル適用基準', format: 'select', unit: '' },
    'evMultiple.pessimistic': { label: 'EVマルチプル(悲観)', format: 'number', unit: 'x' },
    'evMultiple.base': { label: 'EVマルチプル(ベース)', format: 'number', unit: 'x' },
    'evMultiple.optimistic': { label: 'EVマルチプル(楽観)', format: 'number', unit: 'x' },
    maxLifetimeYears: { label: 'LTV計算上限年数', format: 'number', unit: '年' },
  },
  arrays: {},
}
