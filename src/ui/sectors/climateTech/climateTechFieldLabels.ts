/**
 * クライメートテック入力フィールドのラベル表(Excel前提条件シート用)。出典: docs/phase5-spec.md §1.2-2
 * 文言は ClimateTechForm.tsx の実ラベルと一致させる。
 * capexSchedule[] は「年・金額の2列表」として展開する(yearAmountTable、§1.2-2)。
 */
import type { SectorFieldLabelTable } from '../../scenarioEvaluation/fieldLabelTypes.ts'

export const CLIMATE_TECH_FIELD_LABELS: SectorFieldLabelTable = {
  scalars: {
    massProductionYear: { label: '量産化マイルストーン年', format: 'number', unit: '年' },
    massProductionProb: { label: '量産化到達確率', format: 'ratio', unit: '%' },
    subsidyCoverage: { label: '補助金カバー率', format: 'ratio', unit: '%' },
    annualCapacityUnits: { label: '年間生産能力', format: 'number', unit: 'unit' },
    rampYears: { label: 'フル稼働までの年数', format: 'number', unit: '年' },
    unitPrice: { label: '販売単価', format: 'yen', unit: '円/unit' },
    unitCost0: { label: '現在のユニットコスト', format: 'yen', unit: '円/unit' },
    costDeclineRate: { label: 'ユニットコスト年次低減率', format: 'ratio', unit: '%' },
    offtakeCoverage: { label: 'オフテイク契約カバー率', format: 'ratio', unit: '%' },
    merchantRealization: { label: '非オフテイク分の販売実現率', format: 'ratio', unit: '%' },
    fixedOpexAnnual: { label: '量産後の年間固定費', format: 'money', unit: '百万円' },
    carbonCreditVolume: { label: 'カーボンクレジット量', format: 'number', unit: 't-CO2/年' },
    carbonCreditPrice: { label: 'カーボンクレジット価格', format: 'yen', unit: '円/t-CO2' },
    'discountRate.pessimistic': { label: '割引率(悲観)', format: 'ratio', unit: '%' },
    'discountRate.base': { label: '割引率(ベース)', format: 'ratio', unit: '%' },
    'discountRate.optimistic': { label: '割引率(楽観)', format: 'ratio', unit: '%' },
    projectYears: { label: 'プロジェクト評価年数', format: 'number', unit: '年' },
  },
  arrays: {
    capexSchedule: {
      kind: 'yearAmountTable',
      itemFields: {
        yearIndex: { label: '年', format: 'number', unit: '年' },
        amount: { label: '金額', format: 'money', unit: '百万円' },
      },
    },
  },
}
