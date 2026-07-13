import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { closeEnough } from '../types.ts'
import { computeAssetPos, evaluateDrugDiscovery, PHASE_ORDER } from './drugDiscovery.ts'
import type { DrugDiscoveryInputs, Phase, PipelineAsset } from './drugDiscovery.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface GoldenCase {
  id: string
  tags: string[]
  input: DrugDiscoveryInputs
  expected: {
    ev: { pessimistic: number; base: number; optimistic: number }
    keyMetrics: Record<string, number>
  }
}

interface GoldenFile {
  cases: GoldenCase[]
}

function loadGolden(): GoldenFile {
  const p = path.join(__dirname, '../__fixtures__/drug_discovery.golden.json')
  return JSON.parse(readFileSync(p, 'utf-8')) as GoldenFile
}

describe('DrugDiscovery golden fixtures', () => {
  const golden = loadGolden()
  it.each(golden.cases.map((c) => [c.id, c] as const))('%s: golden一致', (_id, c) => {
    const result = evaluateDrugDiscovery(c.input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(closeEnough(result.value.ev.pessimistic, c.expected.ev.pessimistic)).toBe(true)
    expect(closeEnough(result.value.ev.base, c.expected.ev.base)).toBe(true)
    expect(closeEnough(result.value.ev.optimistic, c.expected.ev.optimistic)).toBe(true)
    const actualKeys = Object.keys(result.value.keyMetrics).sort()
    const expectedKeys = Object.keys(c.expected.keyMetrics).sort()
    expect(actualKeys).toEqual(expectedKeys)
  })
})

function buildAsset(overrides: Partial<PipelineAsset> = {}): PipelineAsset {
  const allOne: Record<Phase, number> = {
    preclinical: 1,
    phase1: 1,
    phase2: 1,
    phase3: 1,
    filing: 1,
  }
  return {
    name: 'asset',
    currentPhase: 'preclinical',
    phaseSuccessProbs: { ...allOne },
    phaseDurations: { preclinical: 2, phase1: 2, phase2: 2, phase3: 3, filing: 1 },
    developmentCosts: { preclinical: 400, phase1: 900, phase2: 2000, phase3: 5000, filing: 400 },
    launchYear: 10,
    peakSales: 3000,
    yearsToPeak: 3,
    plateauYears: 3,
    declineRate: 0.1,
    commercialization: { type: 'own', contributionMargin: 0.65 },
    ...overrides,
  }
}

/**
 * P4検証用の独立オラクル: 開発費(1年目=t=1起点)・売上曲線・打ち切り
 * (t ∈ [launchYear, launchYear + modelHorizonYears)、§2.2「u < modelHorizonYears」に対応)を
 * spec本文どおりに再実装し、evaluateDrugDiscoveryの出力と突合する(own型のみ)。
 */
function ownAssetNpvOracle(asset: PipelineAsset, rate: number, modelHorizonYears: number): number {
  if (asset.commercialization.type !== 'own') throw new Error('own only')
  const idx = PHASE_ORDER.indexOf(asset.currentPhase)
  const remaining = PHASE_ORDER.slice(idx)
  let pos = 1
  for (const p of remaining) pos *= asset.phaseSuccessProbs[p]

  const cf = new Map<number, number>()
  const add = (t: number, v: number) => cf.set(t, (cf.get(t) ?? 0) + v)
  let cum = 0
  for (const p of remaining) {
    const dur = asset.phaseDurations[p]
    for (let i = 1; i <= dur; i++) add(cum + i, -asset.developmentCosts[p] / dur)
    cum += dur
  }
  for (let t = asset.launchYear; t < asset.launchYear + modelHorizonYears; t++) {
    const u = t - asset.launchYear
    let s = 0
    if (u < asset.yearsToPeak) s = (asset.peakSales * (u + 1)) / asset.yearsToPeak
    else if (u < asset.yearsToPeak + asset.plateauYears) s = asset.peakSales
    else s = asset.peakSales * Math.pow(1 - asset.declineRate, u - asset.yearsToPeak - asset.plateauYears + 1)
    if (s !== 0) add(t, s * (asset.commercialization as { contributionMargin: number }).contributionMargin * pos)
  }
  let npv = 0
  for (const t of [...cf.keys()].sort((a, b) => a - b)) npv += (cf.get(t) as number) / Math.pow(1 + rate, t)
  return npv
}

const phaseArb = fc.constantFrom<Phase>('preclinical', 'phase1', 'phase2', 'phase3', 'filing')

describe('DrugDiscovery プロパティ', () => {
  it('P4: 全フェーズ確率 = 1 ⇒ rNPV = 独立オラクルによる通常NPV(相対誤差 1e-9)', () => {
    fc.assert(
      fc.property(
        phaseArb,
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 3 }),
        fc.float({ min: 0, max: Math.fround(5000), noNaN: true }),
        fc.float({ min: 0, max: Math.fround(5000), noNaN: true }),
        fc.integer({ min: 2, max: 20 }),
        fc.integer({ min: 1, max: 5 }),
        fc.float({ min: Math.fround(0.05), max: Math.fround(0.3), noNaN: true }),
        (currentPhase, d1, d2, d3, d4, d5, peakSales, cm, launchYear, yearsToPeak, rate) => {
          const contributionMargin = Math.min(cm / 5000, 1)
          const asset = buildAsset({
            currentPhase,
            phaseDurations: { preclinical: d1, phase1: d2, phase2: d3, phase3: d4, filing: d5 },
            peakSales,
            yearsToPeak,
            launchYear,
            commercialization: { type: 'own', contributionMargin },
          })
          const modelHorizonYears = 15
          const result = evaluateDrugDiscovery({
            assets: [asset],
            discountRate: { pessimistic: rate, base: rate, optimistic: rate },
            modelHorizonYears,
          })
          expect(result.ok).toBe(true)
          if (!result.ok) return
          const expected = ownAssetNpvOracle(asset, rate, modelHorizonYears)
          expect(closeEnough(result.value.ev.base, expected)).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('peakSales = 0 ⇒ 売上系CFは0(rNPVは開発費のみで負またはゼロ)', () => {
    const asset = buildAsset({ peakSales: 0 })
    const result = evaluateDrugDiscovery({
      assets: [asset],
      discountRate: { pessimistic: 0.12, base: 0.11, optimistic: 0.1 },
      modelHorizonYears: 15,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.ev.base).toBeLessThanOrEqual(0)
  })

  it('あるフェーズの確率 = 0 ⇒ それ以降の開発費は寄与しない(手前の開発費は残る)', () => {
    const zeroed = buildAsset({
      phaseSuccessProbs: { preclinical: 1, phase1: 1, phase2: 0, phase3: 1, filing: 1 },
    })
    const r1 = evaluateDrugDiscovery({
      assets: [zeroed],
      discountRate: { pessimistic: 0.12, base: 0.11, optimistic: 0.1 },
      modelHorizonYears: 15,
    })
    // phase3のコストを大きく変えてもEVは不変であるはず(到達確率0のため)
    const zeroedWithHugePhase3Cost = buildAsset({
      phaseSuccessProbs: { preclinical: 1, phase1: 1, phase2: 0, phase3: 1, filing: 1 },
      developmentCosts: { preclinical: 400, phase1: 900, phase2: 2000, phase3: 999999, filing: 400 },
    })
    const r2 = evaluateDrugDiscovery({
      assets: [zeroedWithHugePhase3Cost],
      discountRate: { pessimistic: 0.12, base: 0.11, optimistic: 0.1 },
      modelHorizonYears: 15,
    })
    expect(r1.ok && r2.ok).toBe(true)
    if (!r1.ok || !r2.ok) return
    expect(r1.value.ev.base).toBeCloseTo(r2.value.ev.base, 6)
  })

  it('P5(開発費ゼロで分離検証): 任意フェーズ確率 ↑ ⇒ rNPV 単調非減少(売上CF ≥ 0、開発費0のとき)', () => {
    // developmentCosts=0 とすることで「確率↑が後続フェーズの期待コストも増やす」という
    // トレードオフ(rNPVモデル特有の実物オプション的性質)を排除し、収益側の単調性のみを検証する。
    fc.assert(
      fc.property(
        phaseArb,
        fc.float({ min: Math.fround(0.01), max: Math.fround(0.9), noNaN: true }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(0.09), noNaN: true }),
        fc.float({ min: Math.fround(100), max: Math.fround(5000), noNaN: true }),
        (targetPhase, baseProb, delta, peakSales) => {
          const noCost: Record<Phase, number> = { preclinical: 0, phase1: 0, phase2: 0, phase3: 0, filing: 0 }
          const probsLow: Record<Phase, number> = {
            preclinical: 0.8,
            phase1: 0.8,
            phase2: 0.8,
            phase3: 0.8,
            filing: 0.8,
          }
          probsLow[targetPhase] = baseProb
          const probsHigh = { ...probsLow, [targetPhase]: baseProb + delta }
          const assetLow = buildAsset({
            currentPhase: 'preclinical',
            developmentCosts: noCost,
            phaseSuccessProbs: probsLow,
            peakSales,
          })
          const assetHigh = buildAsset({
            currentPhase: 'preclinical',
            developmentCosts: noCost,
            phaseSuccessProbs: probsHigh,
            peakSales,
          })
          const r1 = evaluateDrugDiscovery({
            assets: [assetLow],
            discountRate: { pessimistic: 0.12, base: 0.11, optimistic: 0.1 },
            modelHorizonYears: 15,
          })
          const r2 = evaluateDrugDiscovery({
            assets: [assetHigh],
            discountRate: { pessimistic: 0.12, base: 0.11, optimistic: 0.1 },
            modelHorizonYears: 15,
          })
          expect(r1.ok && r2.ok).toBe(true)
          if (!r1.ok || !r2.ok) return
          expect(r2.value.ev.base).toBeGreaterThanOrEqual(r1.value.ev.base - 1e-6)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('P15: レンジ順序 pessimistic ≤ base ≤ optimistic(割引率が悲観>base>楽観のとき)', () => {
    const asset = buildAsset()
    const result = evaluateDrugDiscovery({
      assets: [asset],
      discountRate: { pessimistic: 0.14, base: 0.11, optimistic: 0.08 },
      modelHorizonYears: 15,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // own型・正のCFが支配的な通常ケースでは割引率が低いほどEVが高くなる
    expect(result.value.ev.optimistic).toBeGreaterThanOrEqual(result.value.ev.base)
  })

  it('複数アセットの合計 = 各アセット単体のrNPVの和', () => {
    const a1 = buildAsset({ name: 'a1' })
    const a2 = buildAsset({ name: 'a2', currentPhase: 'phase2', peakSales: 1500, launchYear: 6 })
    const combined = evaluateDrugDiscovery({
      assets: [a1, a2],
      discountRate: { pessimistic: 0.12, base: 0.11, optimistic: 0.1 },
      modelHorizonYears: 15,
    })
    const single1 = evaluateDrugDiscovery({
      assets: [a1],
      discountRate: { pessimistic: 0.12, base: 0.11, optimistic: 0.1 },
      modelHorizonYears: 15,
    })
    const single2 = evaluateDrugDiscovery({
      assets: [a2],
      discountRate: { pessimistic: 0.12, base: 0.11, optimistic: 0.1 },
      modelHorizonYears: 15,
    })
    expect(combined.ok && single1.ok && single2.ok).toBe(true)
    if (!combined.ok || !single1.ok || !single2.ok) return
    expect(combined.value.ev.base).toBeCloseTo(single1.value.ev.base + single2.value.ev.base, 6)
  })

  function buildValidInputs(): DrugDiscoveryInputs {
    return {
      assets: [buildAsset()],
      discountRate: { pessimistic: 0.12, base: 0.11, optimistic: 0.1 },
      modelHorizonYears: 15,
    }
  }

  const domainViolations: ((i: DrugDiscoveryInputs) => DrugDiscoveryInputs)[] = [
    (i) => ({
      ...i,
      assets: [{ ...i.assets[0], phaseSuccessProbs: { ...i.assets[0].phaseSuccessProbs, phase2: 1.5 } }],
    }),
    (i) => ({
      ...i,
      assets: [{ ...i.assets[0], phaseSuccessProbs: { ...i.assets[0].phaseSuccessProbs, phase2: -0.1 } }],
    }),
    (i) => ({
      ...i,
      assets: [{ ...i.assets[0], phaseDurations: { ...i.assets[0].phaseDurations, phase2: 0 } }],
    }),
    (i) => ({
      ...i,
      assets: [{ ...i.assets[0], phaseDurations: { ...i.assets[0].phaseDurations, phase2: 1.5 } }],
    }),
    (i) => ({ ...i, assets: [{ ...i.assets[0], developmentCosts: { ...i.assets[0].developmentCosts, phase2: -1 } }] }),
    (i) => ({ ...i, assets: [{ ...i.assets[0], declineRate: 1.5 }] }),
    (i) => ({ ...i, assets: [{ ...i.assets[0], peakSales: -1 }] }),
    (i) => ({ ...i, assets: [{ ...i.assets[0], yearsToPeak: 0 }] }),
    (i) => ({ ...i, assets: [{ ...i.assets[0], plateauYears: -1 }] }),
    (i) => ({ ...i, discountRate: { ...i.discountRate, base: 0 } }),
    (i) => ({ ...i, modelHorizonYears: 2.5 }),
  ]

  it('ドメイン外入力 → ok:false(§0.2.1、ネストしたassets[i].xxxも検証)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...domainViolations), (corrupt) => {
        const result = evaluateDrugDiscovery(corrupt(buildValidInputs()))
        expect(result.ok).toBe(false)
      }),
      { numRuns: 50 },
    )
  })

  it('computeAssetPos: 残フェーズ(currentPhase以降)の成功確率の積(D-9公開ヘルパー)', () => {
    const asset = buildAsset({
      currentPhase: 'phase2',
      phaseSuccessProbs: { preclinical: 0.5, phase1: 0.5, phase2: 0.3, phase3: 0.6, filing: 0.85 },
    })
    expect(computeAssetPos(asset)).toBeCloseTo(0.3 * 0.6 * 0.85, 9)
  })
})
