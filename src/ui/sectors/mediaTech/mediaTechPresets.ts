/**
 * メディアテックシナリオプリセット。出典: docs/requirements-rev5.md §3.4
 * 「広告市況悪化/課金転換率改善/ヒット有無」
 *
 * 【プリセット値ポリシー(Rev.5 §3、D-7裁定)】説明文が業界標準値に言及する場合、
 * 該当値は benchmarks.dummy.json(参照日: 2026-07-13)の業界標準値に完全一致させる
 * (本セクターの説明文は現状、業界標準への言及なし)。Stage 1 では値はコード固定とし、
 * 実データへの差し替え後も自動追随しない(動的連動は Stage 2 で検討)。
 */
import type { MediaTechInputs } from '../../../engine/index.ts'

export interface MediaTechPreset {
  id: string
  label: string
  description: string
  inputs: MediaTechInputs
}

export const MEDIA_TECH_PRESETS: MediaTechPreset[] = [
  {
    id: 'ad-market-downturn',
    label: '① 広告市況悪化',
    description: '広告ARPUが下落し、獲得コストも上昇。成長率鈍化',
    inputs: {
      mau: 2_000_000,
      mauGrowth: 0.1,
      growthDecayFactor: 0.85,
      dauMauRatio: 0.35,
      arpuMonthly: { ad: 60, paid: 50, commerce: 15 },
      monthlyChurn: 0.07,
      contentCostRatio: 0.3,
      cpa: 1000,
      evSalesMultiple: { pessimistic: 2, base: 3, optimistic: 4.5 },
      projectionYears: 3,
    },
  },
  {
    id: 'paid-conversion-improved',
    label: '② 課金転換率改善',
    description: '課金ARPUが伸び、広告依存度が低下。継続率も改善',
    inputs: {
      mau: 2_000_000,
      mauGrowth: 0.25,
      growthDecayFactor: 0.85,
      dauMauRatio: 0.45,
      arpuMonthly: { ad: 70, paid: 150, commerce: 20 },
      monthlyChurn: 0.03,
      contentCostRatio: 0.35,
      cpa: 700,
      evSalesMultiple: { pessimistic: 4, base: 6, optimistic: 9 },
      projectionYears: 3,
    },
  },
  {
    id: 'no-hit-stagnation',
    label: '③ ヒットなし・伸び悩み',
    description: 'ヒットコンテンツ不在でMAUが伸び悩み、解約率が上昇',
    inputs: {
      mau: 2_000_000,
      mauGrowth: -0.05,
      growthDecayFactor: 0.85,
      dauMauRatio: 0.25,
      arpuMonthly: { ad: 60, paid: 30, commerce: 10 },
      monthlyChurn: 0.12,
      contentCostRatio: 0.4,
      cpa: 1200,
      evSalesMultiple: { pessimistic: 1, base: 1.8, optimistic: 2.8 },
      projectionYears: 3,
    },
  },
]
