import { EC_D2C_SENSITIVITY_DRIVERS } from '../../../engine/index.ts'
import type { EcD2cInputs } from '../../../engine/index.ts'

type EcD2cDriverId = (typeof EC_D2C_SENSITIVITY_DRIVERS)[number]

/** driverId → 表示ラベル。出典: docs/phase4-spec.md §2.2(各Form.tsxの実ラベルと照合済み) */
const EC_D2C_DRIVER_LABELS: Record<EcD2cDriverId, string> = {
  revenueGrowth: '売上成長率',
  'evMultiple.base': 'EVマルチプル(ベース)',
}

/** 未知の driverId は driverId 文字列をそのまま返す(§2.1)。 */
export function ecD2cDriverLabel(driverId: string, _inputs: EcD2cInputs): string {
  return (EC_D2C_DRIVER_LABELS as Record<string, string>)[driverId] ?? driverId
}
