/**
 * 医療機器シナリオプリセット。出典: docs/requirements-rev4.md §3.3
 * 「承認遅延/償還下振れ/海外展開加速」
 * 業界標準値(data/benchmarks/benchmarks.dummy.json)と整合させた仮値。
 */
import type { MedicalDeviceInputs } from '../../../engine/index.ts'

export interface MedicalDevicePreset {
  id: string
  label: string
  description: string
  inputs: MedicalDeviceInputs
}

export const MEDICAL_DEVICE_PRESETS: MedicalDevicePreset[] = [
  {
    id: 'approval-delay',
    label: '① 承認遅延',
    description: 'Class III想定でPMDA/FDA承認が業界標準を超えて長期化。割引率も上振れ',
    inputs: {
      annualProcedures: 5000,
      procedureGrowth: 0.05,
      deviceClass: 'III',
      launchYear: 3,
      approvalDelayYears: 3,
      pricePerProcedure: 150000,
      peakPenetration: 0.3,
      yearsToPeak: 4,
      recurringRatio: 0.2,
      operatingMargin: 0.15,
      discountRate: { pessimistic: 0.16, base: 0.14, optimistic: 0.12 },
      projectionYears: 10,
      terminalGrowth: 0.02,
    },
  },
  {
    id: 'reimbursement-downside',
    label: '② 償還下振れ',
    description: '保険償還価格が想定を下回り、市場浸透も鈍化',
    inputs: {
      annualProcedures: 5000,
      procedureGrowth: 0.05,
      deviceClass: 'II',
      launchYear: 2,
      approvalDelayYears: 0,
      pricePerProcedure: 90000,
      peakPenetration: 0.15,
      yearsToPeak: 5,
      recurringRatio: 0.1,
      operatingMargin: 0.08,
      discountRate: { pessimistic: 0.15, base: 0.13, optimistic: 0.11 },
      projectionYears: 10,
      terminalGrowth: 0.02,
    },
  },
  {
    id: 'overseas-acceleration',
    label: '③ 海外展開加速',
    description: '海外販売チャネル確立により対象手技数・浸透率とも上振れ',
    inputs: {
      annualProcedures: 8000,
      procedureGrowth: 0.15,
      deviceClass: 'II',
      launchYear: 2,
      approvalDelayYears: 0,
      pricePerProcedure: 160000,
      peakPenetration: 0.5,
      yearsToPeak: 2,
      recurringRatio: 0.25,
      operatingMargin: 0.2,
      discountRate: { pessimistic: 0.12, base: 0.1, optimistic: 0.08 },
      projectionYears: 10,
      terminalGrowth: 0.02,
    },
  },
]
