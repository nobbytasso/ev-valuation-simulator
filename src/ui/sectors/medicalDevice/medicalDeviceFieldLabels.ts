/**
 * 医療機器入力フィールドのラベル表(Excel前提条件シート用)。出典: docs/phase5-spec.md §1.2-2
 * 文言は MedicalDeviceForm.tsx の実ラベルと一致させる。
 */
import type { SectorFieldLabelTable } from '../../scenarioEvaluation/fieldLabelTypes.ts'

export const MEDICAL_DEVICE_FIELD_LABELS: SectorFieldLabelTable = {
  scalars: {
    annualProcedures: { label: '年間対象手技数', format: 'number', unit: '件' },
    procedureGrowth: { label: '手技数成長率(年率)', format: 'ratio', unit: '%' },
    deviceClass: { label: 'クラス分類', format: 'select', unit: '' },
    launchYear: { label: '上市年(承認+償還完了)', format: 'number', unit: '年' },
    approvalDelayYears: { label: '承認遅延年数', format: 'number', unit: '年' },
    pricePerProcedure: { label: '手技あたり単価(償還ベース)', format: 'yen', unit: '円' },
    peakPenetration: { label: '最大浸透率', format: 'ratio', unit: '%' },
    yearsToPeak: { label: '浸透ランプ年数', format: 'number', unit: '年' },
    recurringRatio: { label: 'リカーリング比率', format: 'ratio', unit: '%' },
    operatingMargin: { label: '定常営業利益率', format: 'ratio', unit: '%' },
    'discountRate.pessimistic': { label: '割引率(悲観)', format: 'ratio', unit: '%' },
    'discountRate.base': { label: '割引率(ベース)', format: 'ratio', unit: '%' },
    'discountRate.optimistic': { label: '割引率(楽観)', format: 'ratio', unit: '%' },
    projectionYears: { label: 'DCF予測年数', format: 'number', unit: '年' },
    terminalGrowth: { label: '永久成長率', format: 'ratio', unit: '%' },
  },
  arrays: {},
}
