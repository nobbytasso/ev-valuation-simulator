import type { Phase } from '../../../engine/index.ts'

export const PHASE_LABELS: Record<Phase, string> = {
  preclinical: '非臨床',
  phase1: 'フェーズ1',
  phase2: 'フェーズ2',
  phase3: 'フェーズ3',
  filing: '申請',
}
