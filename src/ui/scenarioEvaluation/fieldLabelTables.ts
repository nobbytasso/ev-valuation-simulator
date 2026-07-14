/** セクターID → フィールドラベル表 の対応(compareEngine・Excel双方から参照する単一の定義)。 */
import type { SectorId } from '../../store/scenarioTypes.ts'
import { CLIMATE_TECH_FIELD_LABELS } from '../sectors/climateTech/climateTechFieldLabels.ts'
import { DRUG_DISCOVERY_FIELD_LABELS } from '../sectors/drugDiscovery/drugDiscoveryFieldLabels.ts'
import { EC_D2C_FIELD_LABELS } from '../sectors/ecD2c/ecD2cFieldLabels.ts'
import { MEDIA_TECH_FIELD_LABELS } from '../sectors/mediaTech/mediaTechFieldLabels.ts'
import { MEDICAL_DEVICE_FIELD_LABELS } from '../sectors/medicalDevice/medicalDeviceFieldLabels.ts'
import { SAAS_FIELD_LABELS } from '../sectors/saas/saasFieldLabels.ts'
import type { SectorFieldLabelTable } from './fieldLabelTypes.ts'

export const FIELD_LABEL_TABLES: Record<SectorId, SectorFieldLabelTable> = {
  saas_jp: SAAS_FIELD_LABELS,
  drug_discovery: DRUG_DISCOVERY_FIELD_LABELS,
  medical_device: MEDICAL_DEVICE_FIELD_LABELS,
  media_tech: MEDIA_TECH_FIELD_LABELS,
  ec_d2c: EC_D2C_FIELD_LABELS,
  climate_tech: CLIMATE_TECH_FIELD_LABELS,
}
