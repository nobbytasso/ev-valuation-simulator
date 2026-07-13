/**
 * クライメートテックシナリオプリセット。出典: docs/requirements-rev4.md §3.6
 * 「①制度追い風+オフテイク確保 ②補助金縮小 ③量産化遅延」
 * 業界標準値(data/benchmarks/benchmarks.dummy.json)と整合させた仮値。
 */
import type { ClimateTechInputs } from '../../../engine/index.ts'

export interface ClimateTechPreset {
  id: string
  label: string
  description: string
  inputs: ClimateTechInputs
}

export const CLIMATE_TECH_PRESETS: ClimateTechPreset[] = [
  {
    id: 'policy-tailwind-offtake-secured',
    label: '① 制度追い風+オフテイク確保',
    description: '補助金拡充とオフテイク契約の積み増しでリスクが大きく低減',
    inputs: {
      capexSchedule: [
        { yearIndex: 0, amount: 2000 },
        { yearIndex: 1, amount: 1500 },
      ],
      subsidyCoverage: 0.4,
      massProductionYear: 4,
      massProductionProb: 0.7,
      annualCapacityUnits: 200000,
      rampYears: 2,
      unitPrice: 8500,
      unitCost0: 8000,
      costDeclineRate: 0.1,
      offtakeCoverage: 0.7,
      merchantRealization: 1.0,
      fixedOpexAnnual: 450,
      carbonCreditVolume: 120000,
      carbonCreditPrice: 6000,
      discountRate: { pessimistic: 0.11, base: 0.09, optimistic: 0.07 },
      projectYears: 20,
    },
  },
  {
    id: 'subsidy-reduction',
    label: '② 補助金縮小',
    description: '政策支援が想定より縮小し、CAPEX負担・割引率とも悪化',
    inputs: {
      capexSchedule: [
        { yearIndex: 0, amount: 2000 },
        { yearIndex: 1, amount: 1500 },
      ],
      subsidyCoverage: 0.1,
      massProductionYear: 4,
      massProductionProb: 0.55,
      annualCapacityUnits: 200000,
      rampYears: 2,
      unitPrice: 8000,
      unitCost0: 9500,
      costDeclineRate: 0.07,
      offtakeCoverage: 0.4,
      merchantRealization: 1.0,
      fixedOpexAnnual: 550,
      carbonCreditVolume: 90000,
      carbonCreditPrice: 4000,
      discountRate: { pessimistic: 0.14, base: 0.12, optimistic: 0.1 },
      projectYears: 20,
    },
  },
  {
    id: 'mass-production-delay',
    label: '③ 量産化遅延',
    description: '量産化マイルストーンが3年後ろ倒しになり、到達確率も低下',
    inputs: {
      capexSchedule: [
        { yearIndex: 0, amount: 2000 },
        { yearIndex: 1, amount: 1500 },
        { yearIndex: 2, amount: 1000 },
      ],
      subsidyCoverage: 0.2,
      massProductionYear: 7,
      massProductionProb: 0.3,
      annualCapacityUnits: 200000,
      rampYears: 3,
      unitPrice: 8000,
      unitCost0: 9800,
      costDeclineRate: 0.06,
      offtakeCoverage: 0.3,
      merchantRealization: 1.0,
      fixedOpexAnnual: 500,
      carbonCreditVolume: 80000,
      carbonCreditPrice: 5000,
      discountRate: { pessimistic: 0.16, base: 0.14, optimistic: 0.12 },
      projectYears: 20,
    },
  },
]
