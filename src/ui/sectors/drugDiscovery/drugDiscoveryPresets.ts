/**
 * 創薬シナリオプリセット。出典: docs/requirements-rev5.md §3.2
 * 「ベース/導出成功/主要品目フェーズ失敗」
 *
 * 【プリセット値ポリシー(Rev.5 §3、D-7裁定)】説明文が業界標準値に言及する場合、
 * 該当値は benchmarks.dummy.json(参照日: 2026-07-13)の業界標準値に完全一致させる。
 * Stage 1 ではプリセット値はコード固定とし、実データへの差し替え後も自動追随しない
 * (ベンチマーク値への動的連動は Stage 2 で検討)。
 * ①の業界標準: pos_preclinical_to_p1=65% / pos_p1_to_p2=52% / pos_p2_to_p3=29% /
 * pos_p3_to_approval=58%(本モデルでは phase3×filing の積で表現)/ discount_rate=11%
 */
import type { DrugDiscoveryInputs } from '../../../engine/index.ts'

export interface DrugDiscoveryPreset {
  id: string
  label: string
  description: string
  inputs: DrugDiscoveryInputs
}

export const DRUG_DISCOVERY_PRESETS: DrugDiscoveryPreset[] = [
  {
    id: 'base',
    label: '① ベース',
    description: '業界標準並みのフェーズ成功確率。自社販売',
    inputs: {
      assets: [
        {
          name: '主力パイプライン',
          currentPhase: 'phase2',
          // phase3 × filing = 0.58(業界標準 pos_p3_to_approval=58% に完全一致)【D-7】
          phaseSuccessProbs: { preclinical: 0.65, phase1: 0.52, phase2: 0.29, phase3: 0.58 / 0.85, filing: 0.85 },
          phaseDurations: { preclinical: 2, phase1: 2, phase2: 2, phase3: 3, filing: 1 },
          developmentCosts: { preclinical: 400, phase1: 900, phase2: 2000, phase3: 5000, filing: 400 },
          launchYear: 6,
          peakSales: 3000,
          yearsToPeak: 3,
          plateauYears: 3,
          declineRate: 0.1,
          commercialization: { type: 'own', contributionMargin: 0.65 },
        },
      ],
      discountRate: { pessimistic: 0.12, base: 0.11, optimistic: 0.1 },
      modelHorizonYears: 15,
    },
  },
  {
    id: 'out-licensing-success',
    label: '② 導出成功',
    description: 'Phase3時点で導出成功。マイルストーン+ロイヤリティ収入、ピーク売上上振れ',
    inputs: {
      assets: [
        {
          name: '導出パイプライン',
          currentPhase: 'phase3',
          phaseSuccessProbs: { preclinical: 0.65, phase1: 0.52, phase2: 0.29, phase3: 0.68, filing: 0.85 },
          phaseDurations: { preclinical: 2, phase1: 2, phase2: 2, phase3: 3, filing: 1 },
          developmentCosts: { preclinical: 400, phase1: 900, phase2: 2000, phase3: 3000, filing: 200 },
          launchYear: 4,
          peakSales: 6000,
          yearsToPeak: 3,
          plateauYears: 4,
          declineRate: 0.08,
          commercialization: {
            type: 'license',
            royaltyRate: 0.15,
            milestones: [
              { phase: 'filing', amount: 1500 },
              { phase: 'launch', amount: 3000 },
            ],
          },
        },
      ],
      discountRate: { pessimistic: 0.12, base: 0.11, optimistic: 0.1 },
      modelHorizonYears: 15,
    },
  },
  {
    id: 'lead-asset-failure',
    label: '③ 主要品目フェーズ失敗',
    description: 'Phase2成功確率が業界標準29%→5%に大幅低下するリスクシナリオ', // 数値明記【C-9裁定】
    inputs: {
      assets: [
        {
          name: '主力パイプライン(Phase2リスク)',
          currentPhase: 'preclinical',
          phaseSuccessProbs: { preclinical: 0.65, phase1: 0.52, phase2: 0.05, phase3: 0.6, filing: 0.85 },
          phaseDurations: { preclinical: 2, phase1: 2, phase2: 2, phase3: 3, filing: 1 },
          developmentCosts: { preclinical: 400, phase1: 900, phase2: 2000, phase3: 5000, filing: 400 },
          launchYear: 10,
          peakSales: 3000,
          yearsToPeak: 3,
          plateauYears: 3,
          declineRate: 0.1,
          commercialization: { type: 'own', contributionMargin: 0.65 },
        },
      ],
      discountRate: { pessimistic: 0.12, base: 0.11, optimistic: 0.1 },
      modelHorizonYears: 15,
    },
  },
]
