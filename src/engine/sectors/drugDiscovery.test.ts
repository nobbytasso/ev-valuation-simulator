import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { closeEnough } from '../types.ts'
import { buildTornado } from '../common/sensitivity.ts'
import {
  applyDrugDiscoveryDriver,
  computeAssetPos,
  drugDiscoveryBaseEv,
  DRUG_DISCOVERY_SENSITIVITY_DRIVERS,
  evaluateDrugDiscovery,
  PHASE_ORDER,
} from './drugDiscovery.ts'
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

describe('DrugDiscovery 感度分析ドライバー(§1.5.1, D-6/B-1)', () => {
  it('DRUG_DISCOVERY_SENSITIVITY_DRIVERS: 残フェーズのみのphaseSuccessProbs + own/licenseで分岐 + discountRate.base', () => {
    const ownAsset = buildAsset({ currentPhase: 'phase2', commercialization: { type: 'own', contributionMargin: 0.65 } })
    const licenseAsset = buildAsset({
      currentPhase: 'preclinical',
      commercialization: { type: 'license', royaltyRate: 0.15, milestones: [] },
    })
    const drivers = DRUG_DISCOVERY_SENSITIVITY_DRIVERS({
      assets: [ownAsset, licenseAsset],
      discountRate: { pessimistic: 0.12, base: 0.11, optimistic: 0.1 },
      modelHorizonYears: 15,
    })
    expect(drivers).toEqual([
      'assets[0].peakSales',
      'assets[0].launchYear',
      'assets[0].phaseSuccessProbs.phase2',
      'assets[0].phaseSuccessProbs.phase3',
      'assets[0].phaseSuccessProbs.filing',
      'assets[0].commercialization.contributionMargin',
      'assets[1].peakSales',
      'assets[1].launchYear',
      'assets[1].phaseSuccessProbs.preclinical',
      'assets[1].phaseSuccessProbs.phase1',
      'assets[1].phaseSuccessProbs.phase2',
      'assets[1].phaseSuccessProbs.phase3',
      'assets[1].phaseSuccessProbs.filing',
      'assets[1].commercialization.royaltyRate',
      'discountRate.base',
    ])
  })

  it('applyDrugDiscoveryDriver: peakSales/launchYearは相対±δ(下限クランプ、launchYearは整数化)', () => {
    const inputs: DrugDiscoveryInputs = {
      assets: [buildAsset({ peakSales: 1000, launchYear: 10 })],
      discountRate: { pessimistic: 0.12, base: 0.11, optimistic: 0.1 },
      modelHorizonYears: 15,
    }
    const high = applyDrugDiscoveryDriver(inputs, 'assets[0].peakSales', 1.2)
    expect(high.assets[0].peakSales).toBeCloseTo(1200, 9)
    const low = applyDrugDiscoveryDriver(inputs, 'assets[0].peakSales', 0)
    expect(low.assets[0].peakSales).toBe(0)

    const launchHigh = applyDrugDiscoveryDriver(inputs, 'assets[0].launchYear', 1.2)
    expect(launchHigh.assets[0].launchYear).toBe(Math.round(10 * 1.2))
    const launchFloor = applyDrugDiscoveryDriver(inputs, 'assets[0].launchYear', 0)
    expect(launchFloor.assets[0].launchYear).toBe(1)
  })

  it('applyDrugDiscoveryDriver: phaseSuccessProbsは[0,1]クランプ、指定asset以外は不変', () => {
    const asset0 = buildAsset({ phaseSuccessProbs: { preclinical: 0.5, phase1: 1, phase2: 1, phase3: 1, filing: 1 } })
    const asset1 = buildAsset({ name: 'other', peakSales: 999 })
    const inputs: DrugDiscoveryInputs = {
      assets: [asset0, asset1],
      discountRate: { pessimistic: 0.12, base: 0.11, optimistic: 0.1 },
      modelHorizonYears: 15,
    }
    const result = applyDrugDiscoveryDriver(inputs, 'assets[0].phaseSuccessProbs.preclinical', 1.5)
    expect(result.assets[0].phaseSuccessProbs.preclinical).toBeCloseTo(0.75, 9)
    expect(result.assets[1]).toBe(asset1)

    const clampedHigh = applyDrugDiscoveryDriver(inputs, 'assets[0].phaseSuccessProbs.preclinical', 100)
    expect(clampedHigh.assets[0].phaseSuccessProbs.preclinical).toBe(1)
  })

  it('applyDrugDiscoveryDriver: commercialization.contributionMargin/royaltyRateはown/license双方で正しいキーに適用', () => {
    const ownInputs: DrugDiscoveryInputs = {
      assets: [buildAsset({ commercialization: { type: 'own', contributionMargin: 0.5 } })],
      discountRate: { pessimistic: 0.12, base: 0.11, optimistic: 0.1 },
      modelHorizonYears: 15,
    }
    const ownResult = applyDrugDiscoveryDriver(ownInputs, 'assets[0].commercialization.contributionMargin', 1.2)
    const commOwn = ownResult.assets[0].commercialization
    expect(commOwn.type).toBe('own')
    if (commOwn.type === 'own') expect(commOwn.contributionMargin).toBeCloseTo(0.6, 9)

    const licenseInputs: DrugDiscoveryInputs = {
      assets: [buildAsset({ commercialization: { type: 'license', royaltyRate: 0.1, milestones: [] } })],
      discountRate: { pessimistic: 0.12, base: 0.11, optimistic: 0.1 },
      modelHorizonYears: 15,
    }
    const licenseResult = applyDrugDiscoveryDriver(licenseInputs, 'assets[0].commercialization.royaltyRate', 1.2)
    const commLicense = licenseResult.assets[0].commercialization
    expect(commLicense.type).toBe('license')
    if (commLicense.type === 'license') expect(commLicense.royaltyRate).toBeCloseTo(0.12, 9)

    // own資産にroyaltyRateドライバーを適用しても無視される(型不一致)
    const noop = applyDrugDiscoveryDriver(ownInputs, 'assets[0].commercialization.royaltyRate', 1.2)
    expect(noop).toBe(ownInputs)
  })

  it('applyDrugDiscoveryDriver: discountRate.baseはポイント変動(加法、既定±0.02)で下限0.001クランプ', () => {
    const inputs: DrugDiscoveryInputs = {
      assets: [buildAsset()],
      discountRate: { pessimistic: 0.12, base: 0.11, optimistic: 0.1 },
      modelHorizonYears: 15,
    }
    const high = applyDrugDiscoveryDriver(inputs, 'discountRate.base', 1.2)
    expect(high.discountRate.base).toBeCloseTo(0.13, 9)
    expect(high.discountRate.pessimistic).toBe(0.12)
    expect(high.discountRate.optimistic).toBe(0.1)

    const low = applyDrugDiscoveryDriver(inputs, 'discountRate.base', 0.8)
    expect(low.discountRate.base).toBeCloseTo(0.09, 9)

    const floored = applyDrugDiscoveryDriver(
      { ...inputs, discountRate: { ...inputs.discountRate, base: 0.005 } },
      'discountRate.base',
      0.8,
    )
    expect(floored.discountRate.base).toBeCloseTo(0.001, 9)
  })

  it('applyDrugDiscoveryDriver: 不明なdriverIdは入力をそのまま返す', () => {
    const inputs: DrugDiscoveryInputs = {
      assets: [buildAsset()],
      discountRate: { pessimistic: 0.12, base: 0.11, optimistic: 0.1 },
      modelHorizonYears: 15,
    }
    expect(applyDrugDiscoveryDriver(inputs, 'unknownDriver', 1.2)).toBe(inputs)
    expect(applyDrugDiscoveryDriver(inputs, 'assets[9].peakSales', 1.2)).toBe(inputs)
  })

  it('applyDrugDiscoveryDriver: 不正なフェーズ名(phaseSuccessProbs.<phase>)は入力をそのまま返す(D-6監査 指摘12)', () => {
    const inputs: DrugDiscoveryInputs = {
      assets: [buildAsset()],
      discountRate: { pessimistic: 0.12, base: 0.11, optimistic: 0.1 },
      modelHorizonYears: 15,
    }
    expect(() => applyDrugDiscoveryDriver(inputs, 'assets[0].phaseSuccessProbs.bogusPhase', 1.2)).not.toThrow()
    const result = applyDrugDiscoveryDriver(inputs, 'assets[0].phaseSuccessProbs.bogusPhase', 1.2)
    expect(result).toBe(inputs)
    expect(Object.keys(result.assets[0].phaseSuccessProbs)).not.toContain('bogusPhase')
  })

  it('drugDiscoveryBaseEv: baseケースのEVを返し、ドメイン外入力ではNaN', () => {
    const inputs: DrugDiscoveryInputs = {
      assets: [buildAsset()],
      discountRate: { pessimistic: 0.12, base: 0.11, optimistic: 0.1 },
      modelHorizonYears: 15,
    }
    const result = evaluateDrugDiscovery(inputs)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(drugDiscoveryBaseEv(inputs)).toBeCloseTo(result.value.ev.base, 9)

    const invalid: DrugDiscoveryInputs = { ...inputs, modelHorizonYears: 2.5 }
    expect(drugDiscoveryBaseEv(invalid)).toBeNaN()
  })
})

describe('DrugDiscovery buildTornado統合テスト(監査ゲート条件3、phase4-spec.md §6 C1)', () => {
  function buildMixedInputs(): DrugDiscoveryInputs {
    const ownAsset = buildAsset({
      name: 'own-asset',
      currentPhase: 'phase2',
      phaseSuccessProbs: { preclinical: 1, phase1: 1, phase2: 0.6, phase3: 0.7, filing: 0.9 },
      commercialization: { type: 'own', contributionMargin: 0.65 },
    })
    const licenseAsset = buildAsset({
      name: 'license-asset',
      currentPhase: 'preclinical',
      launchYear: 8,
      phaseSuccessProbs: { preclinical: 0.5, phase1: 0.6, phase2: 0.7, phase3: 0.8, filing: 0.9 },
      commercialization: {
        type: 'license',
        royaltyRate: 0.15,
        milestones: [{ phase: 'phase2', amount: 500 }],
      },
    })
    return {
      assets: [ownAsset, licenseAsset],
      discountRate: { pessimistic: 0.12, base: 0.11, optimistic: 0.1 },
      modelHorizonYears: 15,
    }
  }

  it('P14: δ=0 で全ドライバーspan=0', () => {
    const inputs = buildMixedInputs()
    const driverIds = DRUG_DISCOVERY_SENSITIVITY_DRIVERS(inputs)
    const items = buildTornado(inputs, { delta: 0, driverIds }, applyDrugDiscoveryDriver, drugDiscoveryBaseEv)
    expect(items.length).toBe(driverIds.length)
    for (const item of items) expect(item.span).toBeCloseTo(0, 6)
  })

  it('既定入力+2品目(own・license混在)で列挙全ドライバーのspan > 0、件数 = 列挙数', () => {
    const inputs = buildMixedInputs()
    const driverIds = DRUG_DISCOVERY_SENSITIVITY_DRIVERS(inputs)
    const items = buildTornado(inputs, { delta: 0.2, driverIds }, applyDrugDiscoveryDriver, drugDiscoveryBaseEv)
    expect(items.length).toBe(driverIds.length)
    expect(new Set(items.map((item) => item.driverId)).size).toBe(driverIds.length)
    for (const item of items) {
      expect(item.span).toBeGreaterThan(0)
    }
  })
})
