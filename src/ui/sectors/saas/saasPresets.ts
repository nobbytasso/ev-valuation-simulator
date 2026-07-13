/**
 * SaaS(日本)シナリオプリセット。出典: docs/requirements-rev4.md §3.1
 * 「①順調(Rule of 40達成継続) ②成長鈍化・利益率業界標準並 ③停滞・利益率業界標準以下」
 * 業界標準値(data/benchmarks/benchmarks.dummy.json)と整合させた仮値。
 */
import type { SaasInputs } from '../../../engine/index.ts'

export interface SaasPreset {
  id: string
  label: string
  description: string
  inputs: SaasInputs
}

export const SAAS_PRESETS: SaasPreset[] = [
  {
    id: 'steady',
    label: '① 順調',
    description: 'Rule of 40達成を継続。高成長+黒字化進行',
    inputs: {
      arr: 1000,
      arrGrowth: 0.35,
      nrr: 1.15,
      grossMargin: 0.75,
      operatingMargin: 0.08,
      fcfMargin: 0.08,
      grossChurn: 0.05,
      cacPaybackMonths: 12,
      arrBasis: 'ntm',
      evArrMultiple: { pessimistic: 6, base: 8.2, optimistic: 11 },
      projectionYears: 5,
      growthDecayFactor: 0.85,
      discountRate: 0.12,
      terminalGrowth: 0.02,
    },
  },
  {
    id: 'decelerating',
    label: '② 成長鈍化',
    description: '成長率が業界標準を下回り鈍化。利益率は業界標準並み',
    inputs: {
      arr: 1000,
      arrGrowth: 0.15,
      nrr: 1.05,
      grossMargin: 0.7,
      operatingMargin: 0.03,
      fcfMargin: 0.03,
      grossChurn: 0.12,
      cacPaybackMonths: 20,
      arrBasis: 'ntm',
      evArrMultiple: { pessimistic: 3.5, base: 5.5, optimistic: 7 },
      projectionYears: 5,
      growthDecayFactor: 0.8,
      discountRate: 0.13,
      terminalGrowth: 0.02,
    },
  },
  {
    id: 'stagnant',
    label: '③ 停滞',
    description: '成長ほぼ停止。利益率は業界標準を下回り赤字継続',
    inputs: {
      arr: 1000,
      arrGrowth: 0.02,
      nrr: 0.95,
      grossMargin: 0.65,
      operatingMargin: -0.1,
      fcfMargin: -0.1,
      grossChurn: 0.2,
      cacPaybackMonths: 32,
      arrBasis: 'current',
      evArrMultiple: { pessimistic: 1.5, base: 3, optimistic: 4.5 },
      projectionYears: 5,
      growthDecayFactor: 0.9,
      discountRate: 0.16,
      terminalGrowth: 0.01,
    },
  },
]
