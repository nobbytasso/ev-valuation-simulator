import { SAAS_SENSITIVITY_DRIVERS } from '../../../engine/index.ts'
import type { SaasInputs } from '../../../engine/index.ts'

type SaasDriverId = (typeof SAAS_SENSITIVITY_DRIVERS)[number]

/** driverId → 表示ラベル。出典: docs/phase4-spec.md §2.2(各Form.tsxの実ラベルと照合済み) */
const SAAS_DRIVER_LABELS: Record<SaasDriverId, string> = {
  arrGrowth: 'ARR成長率',
  'evArrMultiple.base': 'EV/ARRマルチプル(ベース)',
}

/** 未知の driverId は driverId 文字列をそのまま返す(§2.1)。 */
export function saasDriverLabel(driverId: string, _inputs: SaasInputs): string {
  return (SAAS_DRIVER_LABELS as Record<string, string>)[driverId] ?? driverId
}
