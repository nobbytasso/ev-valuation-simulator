/**
 * EC/D2Cシナリオプリセット。出典: docs/requirements-rev5.md §3.5
 * 「①リピート育成成功 ②広告依存継続(CAC上昇) ③成長鈍化・在庫リスク」
 *
 * 【プリセット値ポリシー(Rev.5 §3、D-7裁定)】説明文が業界標準値に言及する場合、
 * 該当値は benchmarks.dummy.json(参照日: 2026-07-13)の業界標準値に完全一致させる。
 * Stage 1 ではプリセット値はコード固定とし、実データへの差し替え後も自動追随しない
 * (ベンチマーク値への動的連動は Stage 2 で検討)。
 */
import type { EcD2cInputs } from '../../../engine/index.ts'

export interface EcD2cPreset {
  id: string
  label: string
  description: string
  inputs: EcD2cInputs
}

export const EC_D2C_PRESETS: EcD2cPreset[] = [
  {
    id: 'repeat-success',
    label: '① リピート育成成功',
    description: 'F2転換率・LTV/CACともに業界標準を上回る。広告依存度は低い',
    inputs: {
      annualRevenue: 2000,
      revenueGrowth: 0.3,
      grossMargin: 0.6,
      f2Rate: 0.4,
      aov: 8000,
      purchaseFrequency: 3.5,
      cac: 3500,
      adCostRatio: 0.15,
      logisticsCostRatio: 0.08,
      inventoryTurnover: 8,
      multipleBasis: 'revenue',
      evMultiple: { pessimistic: 2, base: 3, optimistic: 4.5 },
      maxLifetimeYears: 10,
    },
  },
  {
    id: 'ad-dependent',
    label: '② 広告依存継続(CAC上昇)',
    description: 'F2転換率は業界標準並みだがCACが上昇し広告費率が高止まり',
    inputs: {
      annualRevenue: 2000,
      revenueGrowth: 0.2,
      grossMargin: 0.55,
      f2Rate: 0.28, // = 業界標準28%(f2_conversion)に完全一致【D-7】
      aov: 7500,
      purchaseFrequency: 2.2,
      cac: 6000,
      adCostRatio: 0.28,
      logisticsCostRatio: 0.1,
      inventoryTurnover: 6,
      multipleBasis: 'revenue',
      evMultiple: { pessimistic: 1.2, base: 1.9, optimistic: 2.8 },
      maxLifetimeYears: 10,
    },
  },
  {
    id: 'stagnant-inventory-risk',
    label: '③ 成長鈍化・在庫リスク',
    description: '成長率が鈍化し在庫回転も低下。粗利率も業界標準を下回る',
    inputs: {
      annualRevenue: 2000,
      revenueGrowth: 0.05,
      grossMargin: 0.45,
      f2Rate: 0.18,
      aov: 7000,
      purchaseFrequency: 1.8,
      cac: 5500,
      adCostRatio: 0.25,
      logisticsCostRatio: 0.15,
      inventoryTurnover: 2.5,
      multipleBasis: 'revenue',
      evMultiple: { pessimistic: 0.6, base: 1.0, optimistic: 1.6 },
      maxLifetimeYears: 10,
    },
  },
]
