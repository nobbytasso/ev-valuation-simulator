import { MEDICAL_DEVICE_SENSITIVITY_DRIVERS } from '../../../engine/index.ts'
import type { MedicalDeviceInputs } from '../../../engine/index.ts'

type MedicalDeviceDriverId = (typeof MEDICAL_DEVICE_SENSITIVITY_DRIVERS)[number]

/** driverId → 表示ラベル。出典: docs/phase4-spec.md §2.2(各Form.tsxの実ラベルと照合済み) */
const MEDICAL_DEVICE_DRIVER_LABELS: Record<MedicalDeviceDriverId, string> = {
  peakPenetration: '最大浸透率',
  approvalDelayYears: '承認遅延年数',
  pricePerProcedure: '手技あたり単価',
  procedureGrowth: '手技数成長率',
}

/** 未知の driverId は driverId 文字列をそのまま返す(§2.1)。 */
export function medicalDeviceDriverLabel(driverId: string, _inputs: MedicalDeviceInputs): string {
  return (MEDICAL_DEVICE_DRIVER_LABELS as Record<string, string>)[driverId] ?? driverId
}
