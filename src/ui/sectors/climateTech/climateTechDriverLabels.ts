import { CLIMATE_TECH_SENSITIVITY_DRIVERS } from '../../../engine/index.ts'
import type { ClimateTechInputs } from '../../../engine/index.ts'

type ClimateTechDriverId = (typeof CLIMATE_TECH_SENSITIVITY_DRIVERS)[number]

/** driverId → 表示ラベル。出典: docs/phase4-spec.md §2.2(各Form.tsxの実ラベルと照合済み) */
const CLIMATE_TECH_DRIVER_LABELS: Record<ClimateTechDriverId, string> = {
  massProductionProb: '量産化到達確率',
  subsidyCoverage: '補助金カバー率',
  carbonCreditPrice: 'カーボンクレジット価格',
  unitPrice: '販売単価',
}

/** 未知の driverId は driverId 文字列をそのまま返す(§2.1)。 */
export function climateTechDriverLabel(driverId: string, _inputs: ClimateTechInputs): string {
  return (CLIMATE_TECH_DRIVER_LABELS as Record<string, string>)[driverId] ?? driverId
}
