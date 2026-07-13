// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PipelineAsset } from '../../../engine/index.ts'
import { DrugAssetForm } from './DrugAssetForm.tsx'

function buildAsset(overrides: Partial<PipelineAsset> = {}): PipelineAsset {
  return {
    name: '品目A',
    currentPhase: 'phase2',
    phaseSuccessProbs: { preclinical: 0.5, phase1: 0.5, phase2: 0.3, phase3: 0.6, filing: 0.85 },
    phaseDurations: { preclinical: 2, phase1: 2, phase2: 2, phase3: 3, filing: 1 },
    developmentCosts: { preclinical: 400, phase1: 900, phase2: 2000, phase3: 5000, filing: 400 },
    launchYear: 10,
    peakSales: 2000,
    yearsToPeak: 3,
    plateauYears: 3,
    declineRate: 0.1,
    commercialization: { type: 'license', royaltyRate: 0.12, milestones: [{ phase: 'phase3', amount: 500 }] },
    ...overrides,
  }
}

describe('DrugAssetForm マイルストーン選択肢(C-6)', () => {
  it('現フェーズより前のフェーズは選択肢に出ない(残フェーズ+上市時のみ)', () => {
    render(<DrugAssetForm asset={buildAsset()} onChange={vi.fn()} onRemove={vi.fn()} canRemove={true} />)
    const select = screen.getByLabelText('発生タイミング') as HTMLSelectElement
    const optionLabels = [...select.options].map((o) => o.textContent)
    expect(optionLabels).toEqual(['フェーズ2完了時', 'フェーズ3完了時', '申請完了時', '上市時'])
    expect(optionLabels).not.toContain('非臨床完了時')
    expect(optionLabels).not.toContain('フェーズ1完了時')
  })
})
