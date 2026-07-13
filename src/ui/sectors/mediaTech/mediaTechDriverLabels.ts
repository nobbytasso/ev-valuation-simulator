import { MEDIA_TECH_SENSITIVITY_DRIVERS } from '../../../engine/index.ts'
import type { MediaTechInputs } from '../../../engine/index.ts'

type MediaTechDriverId = (typeof MEDIA_TECH_SENSITIVITY_DRIVERS)[number]

/** driverId → 表示ラベル。出典: docs/phase4-spec.md §2.2(各Form.tsxの実ラベルと照合済み) */
const MEDIA_TECH_DRIVER_LABELS: Record<MediaTechDriverId, string> = {
  mauGrowth: 'MAU成長率',
  'evSalesMultiple.base': 'EV/売上マルチプル(ベース)',
}

/** 未知の driverId は driverId 文字列をそのまま返す(§2.1)。 */
export function mediaTechDriverLabel(driverId: string, _inputs: MediaTechInputs): string {
  return (MEDIA_TECH_DRIVER_LABELS as Record<string, string>)[driverId] ?? driverId
}
