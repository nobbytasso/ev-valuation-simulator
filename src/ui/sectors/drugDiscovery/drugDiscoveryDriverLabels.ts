import { PHASE_ORDER } from '../../../engine/index.ts'
import type { DrugDiscoveryInputs, Phase } from '../../../engine/index.ts'
import { PHASE_LABELS } from './phaseLabels.ts'

const ASSET_DRIVER_RE = /^assets\[(\d+)\]\.(.+)$/

/** {サブドライバー}の日本語ラベル。フェーズ確率のみ PHASE_LABELS から合成する。出典: docs/phase4-spec.md §2.2 */
function subDriverLabel(subPath: string): string | undefined {
  if (subPath === 'peakSales') return 'ピーク売上'
  if (subPath === 'launchYear') return '上市年'
  if (subPath === 'commercialization.contributionMargin') return '貢献利益率'
  if (subPath === 'commercialization.royaltyRate') return 'ロイヤリティ率'
  if (subPath.startsWith('phaseSuccessProbs.')) {
    const phaseName = subPath.slice('phaseSuccessProbs.'.length)
    if (PHASE_ORDER.includes(phaseName as Phase)) return `${PHASE_LABELS[phaseName as Phase]}成功確率`
  }
  return undefined
}

/**
 * driverId → 表示ラベル。§2.1の合成手順:
 * 1. discountRate.base → 固定文言
 * 2. assets[<i>].<sub> をパースし、品目名 + サブドライバー名を「{品目名}: {ドライバー名}」で合成
 * 未知の driverId・範囲外の asset index・未知の sub パスは driverId をそのまま返す(§2.1)。
 */
export function drugDiscoveryDriverLabel(driverId: string, inputs: DrugDiscoveryInputs): string {
  if (driverId === 'discountRate.base') return '割引率(ベース)'

  const match = ASSET_DRIVER_RE.exec(driverId)
  if (!match) return driverId
  const index = Number(match[1])
  const subPath = match[2]
  const asset = inputs.assets[index]
  if (!asset) return driverId

  const subLabel = subDriverLabel(subPath)
  if (!subLabel) return driverId
  return `${asset.name}: ${subLabel}`
}
