/**
 * 創薬(rNPV)。
 * 出典: docs/engine-spec.md §2.2
 *
 * 評価手法: パイプライン品目ごとの rNPV の総和。
 * 依存ゼロの純粋関数のみ。
 *
 * 【仕様解釈】
 * 1. 開発費キャッシュフローのタイミング: t=0 を評価基準時点とし、残フェーズの最初の年の
 *    キャッシュフローは t=1 に発生する(t=0 には発生しない)。すなわち残フェーズを
 *    p_1..p_m とすると、p_j の費用は t = cumBefore(p_j)+1 .. cumBefore(p_j)+dur(p_j)
 *    の各年末に発生する(cumBefore(p_j) = Σ_{i<j} dur(p_i))。フェーズ完了年
 *    (cumThrough(p_j) = cumBefore(p_j)+dur(p_j))はこの範囲の最終年と一致する。
 * 2. マイルストーン発生年 t_e は上記と同じ cumThrough(phase) を用いる(スペック文言
 *    「フェーズ完了年(現在からの累積duration)」と整合)。
 * 3. modelHorizonYears は文言通り「上市後の評価年数」= launchYear からの相対年数。
 *    u < modelHorizonYears(§2.2)の範囲、すなわち t ∈ [launchYear, launchYear + modelHorizonYears)
 *    を評価する(launchYearの大小に関わらず常に modelHorizonYears 年分の売上を評価する)。
 */
import { atLeast, collectIssues, inRange, nonNegativeInteger, positiveInteger } from '../common/validation.ts'
import type { EngineResult, Money, Range3, Ratio, SectorValuationResult, ValidationIssue, YearIndex } from '../types.ts'

export type Phase = 'preclinical' | 'phase1' | 'phase2' | 'phase3' | 'filing'
// フェーズ順序は上記の通り。'filing' 成功で上市
export const PHASE_ORDER: readonly Phase[] = ['preclinical', 'phase1', 'phase2', 'phase3', 'filing']

export interface PipelineAsset {
  name: string
  currentPhase: Phase
  /** フェーズ別成功確率。既定値同梱(仮値 → U-18)、編集可。定義域 [0, 1] */
  phaseSuccessProbs: Record<Phase, Ratio>
  /** フェーズ別所要年数。既定値同梱。開発費の期間配分に使用 */
  phaseDurations: Record<Phase, number>
  /** フェーズ別開発費総額(そのフェーズの期間に均等配分) */
  developmentCosts: Record<Phase, Money>
  launchYear: YearIndex // 上市年(入力ドライバー。感度対象)(→ U-5)
  peakSales: Money // ピーク売上。≥ 0
  yearsToPeak: number // 上市→ピーク到達年数(線形ランプ)。≥ 1
  plateauYears: number // ピーク維持年数。≥ 0
  declineRate: Ratio // 特許切れ後の年次減衰。[0, 1]
  commercialization:
    | { type: 'own'; contributionMargin: Ratio } // 自社販売: 売上×貢献利益率がCF
    | {
        type: 'license'
        royaltyRate: Ratio // 売上ロイヤリティ
        milestones: { phase: Phase | 'launch'; amount: Money }[] // イベント時マイルストーン
      }
}

export interface DrugDiscoveryInputs {
  assets: PipelineAsset[]
  discountRate: Range3<Ratio> // 既定 {pess: 0.12, base: 0.11, opt: 0.10}(→ U-4)
  modelHorizonYears: number // 上市後の評価年数。既定 15(仮値 → U-6)
}

interface PhaseTiming {
  pReach: Partial<Record<Phase, number>> // 到達確率(自身の成功確率は含まない)
  pos: number // 上市確率 = 全フェーズ成功確率の積
  cumThrough: Partial<Record<Phase, number>> // フェーズ完了年(現在からの累積duration)
  remaining: Phase[]
}

/**
 * 残フェーズ(currentPhase以降)の成功確率の積 = 上市確率(POS)。§2.2定義式そのまま。
 * UI側での複製実装を避けるための公開ヘルパー(D-9/B-3)。keyMetricsには含めない
 * (含めるとgolden fixtureの出力が変わり再生成が必要になるため)。
 */
export function computeAssetPos(asset: PipelineAsset): Ratio {
  const idx = PHASE_ORDER.indexOf(asset.currentPhase)
  const remaining = PHASE_ORDER.slice(idx)
  return remaining.reduce((acc, phase) => acc * asset.phaseSuccessProbs[phase], 1)
}

function computePhaseTiming(asset: PipelineAsset): PhaseTiming {
  const idx = PHASE_ORDER.indexOf(asset.currentPhase)
  const remaining = PHASE_ORDER.slice(idx)
  const pReach: Partial<Record<Phase, number>> = {}
  let cumProb = 1
  for (const p of remaining) {
    pReach[p] = cumProb
    cumProb *= asset.phaseSuccessProbs[p]
  }
  const pos = computeAssetPos(asset)

  const cumThrough: Partial<Record<Phase, number>> = {}
  let cumYears = 0
  for (const p of remaining) {
    cumYears += asset.phaseDurations[p]
    cumThrough[p] = cumYears
  }

  return { pReach, pos, cumThrough, remaining }
}

function salesAtYear(asset: PipelineAsset, t: YearIndex): number {
  const u = t - asset.launchYear
  if (u < 0) return 0
  if (u < asset.yearsToPeak) return (asset.peakSales * (u + 1)) / asset.yearsToPeak
  if (u < asset.yearsToPeak + asset.plateauYears) return asset.peakSales
  return asset.peakSales * Math.pow(1 - asset.declineRate, u - asset.yearsToPeak - asset.plateauYears + 1)
}

function computeAssetRnpv(asset: PipelineAsset, rate: Ratio, modelHorizonYears: number): Money {
  const { pReach, pos, cumThrough, remaining } = computePhaseTiming(asset)
  const cf = new Map<number, number>()
  const add = (t: number, v: number) => cf.set(t, (cf.get(t) ?? 0) + v)

  // 開発費(フェーズp、その期間の各年): −(developmentCosts[p] / phaseDurations[p]) × P_reach(p)
  // タイミングは1年目=t=1(現在t=0は費用発生させない)。
  for (const p of remaining) {
    const dur = asset.phaseDurations[p]
    const cumBefore = (cumThrough[p] as number) - dur
    const perYear = asset.developmentCosts[p] / dur
    const prob = pReach[p] as number
    for (let i = 1; i <= dur; i++) {
      add(cumBefore + i, -perYear * prob)
    }
  }

  // 売上系CF(own: contributionMargin、license: royaltyRate)、POSでリスク調整。
  // modelHorizonYears は launchYear からの相対年数(コメント参照)。u ∈ [0, modelHorizonYears)。
  for (let t = asset.launchYear; t < asset.launchYear + modelHorizonYears; t++) {
    const s = salesAtYear(asset, t)
    if (s === 0) continue
    if (asset.commercialization.type === 'own') {
      add(t, s * asset.commercialization.contributionMargin * pos)
    } else {
      add(t, s * asset.commercialization.royaltyRate * pos)
    }
  }

  // マイルストーン(イベントe、発生年t_e): amount × P_reach(e)。'launch' は L、P_reach(launch)=POS。
  if (asset.commercialization.type === 'license') {
    for (const m of asset.commercialization.milestones) {
      if (m.phase === 'launch') {
        add(asset.launchYear, m.amount * pos)
        continue
      }
      const t_e = cumThrough[m.phase]
      const prob = pReach[m.phase]
      if (t_e !== undefined && prob !== undefined) {
        add(t_e, m.amount * prob)
      } else {
        // currentPhase より前のフェーズを指すマイルストーン(既に到達済み)。
        // タイミング情報がないため t=0・到達確率1として計上する(仮値 → TODO)。
        add(0, m.amount)
      }
    }
  }

  const sortedT = [...cf.keys()].sort((a, b) => a - b)
  let npv = 0
  for (const t of sortedT) {
    npv += (cf.get(t) as number) / Math.pow(1 + rate, t)
  }
  return npv
}

/** 品目1件分のドメイン検証(§0.2.1)。フィールド名は assets[<i>].xxx 形式。 */
function validateAsset(asset: PipelineAsset, index: number): ValidationIssue[] {
  const prefix = `assets[${index}]`
  const checks: (ValidationIssue | null)[] = []
  for (const phase of PHASE_ORDER) {
    checks.push(inRange(asset.phaseSuccessProbs[phase], `${prefix}.phaseSuccessProbs.${phase}`, 0, 1))
    checks.push(positiveInteger(asset.phaseDurations[phase], `${prefix}.phaseDurations.${phase}`))
    checks.push(atLeast(asset.developmentCosts[phase], `${prefix}.developmentCosts.${phase}`, 0))
  }
  checks.push(inRange(asset.declineRate, `${prefix}.declineRate`, 0, 1))
  checks.push(atLeast(asset.peakSales, `${prefix}.peakSales`, 0))
  checks.push(positiveInteger(asset.yearsToPeak, `${prefix}.yearsToPeak`))
  checks.push(nonNegativeInteger(asset.plateauYears, `${prefix}.plateauYears`))
  return collectIssues(...checks)
}

/**
 * 境界条件:
 * - 全フェーズ確率 = 1 ⇒ rNPV = 通常NPV
 * - あるフェーズの確率 = 0 ⇒ それ以降の開発費・売上・マイルストーンの寄与 = 0(手前の開発費は残る)
 * - peakSales = 0 ⇒ 売上系CF = 0(rNPVは開発費のみで負)
 * - rNPV は負になり得る(そのまま返す)
 */
export function evaluateDrugDiscovery(inputs: DrugDiscoveryInputs): EngineResult<SectorValuationResult> {
  const issues = [
    ...inputs.assets.flatMap((asset, i) => validateAsset(asset, i)),
    ...collectIssues(
      atLeast(inputs.discountRate.pessimistic, 'discountRate.pessimistic', 0, { exclusive: true }),
      atLeast(inputs.discountRate.base, 'discountRate.base', 0, { exclusive: true }),
      atLeast(inputs.discountRate.optimistic, 'discountRate.optimistic', 0, { exclusive: true }),
      positiveInteger(inputs.modelHorizonYears, 'modelHorizonYears'),
    ),
  ]
  if (issues.length > 0) return { ok: false, errors: issues }

  const evAt = (rate: Ratio): Money =>
    inputs.assets.reduce((sum, asset) => sum + computeAssetRnpv(asset, rate, inputs.modelHorizonYears), 0)

  const ev = {
    pessimistic: evAt(inputs.discountRate.pessimistic),
    base: evAt(inputs.discountRate.base),
    optimistic: evAt(inputs.discountRate.optimistic),
  }

  return { ok: true, value: { ev, keyMetrics: {} } }
}

/**
 * 感度分析ドライバー(§1.5.1、B-1/D-6対応)。品目配列(assets)の内部が対象のためパス形式で列挙する。
 * 品目数に比例して増える(動的生成)。表示件数の絞り込み(span降順上位N件)はUI層の責務。
 *
 * phaseSuccessProbs は残フェーズ(currentPhase以降)のみを列挙する。既に完了したフェーズの確率は
 * computeAssetRnpv 内で参照されず(remaining = PHASE_ORDER.slice(idx) のみ使用)、含めても
 * span=0 の無意味なドライバーになるだけのため対象外とした(仕様書に明記なし → 実装判断)。
 */
export function DRUG_DISCOVERY_SENSITIVITY_DRIVERS(inputs: DrugDiscoveryInputs): string[] {
  const driverIds: string[] = []
  inputs.assets.forEach((asset, i) => {
    const prefix = `assets[${i}]`
    driverIds.push(`${prefix}.peakSales`)
    driverIds.push(`${prefix}.launchYear`)
    const idx = PHASE_ORDER.indexOf(asset.currentPhase)
    for (const phase of PHASE_ORDER.slice(idx)) {
      driverIds.push(`${prefix}.phaseSuccessProbs.${phase}`)
    }
    if (asset.commercialization.type === 'own') {
      driverIds.push(`${prefix}.commercialization.contributionMargin`)
    } else {
      driverIds.push(`${prefix}.commercialization.royaltyRate`)
    }
  })
  driverIds.push('discountRate.base')
  return driverIds
}

const ASSET_DRIVER_RE = /^assets\[(\d+)\]\.(.+)$/

/**
 * ドライバーを相対変動させ、定義域端にクランプする(§1.5.1, U-15)。
 * - 確率系(phaseSuccessProbs/contributionMargin/royaltyRate)・peakSales は相対±δ(乗算)。
 * - launchYear は相対±δ後に四捨五入で整数化、下限1。
 * - discountRate.base のみポイント変動(加法)。乗算のmultiplier(1±δ)から符号のみを取り出し、
 *   固定幅 δ_r(既定0.02、U-20)を加減算する。δ_rを可変にする場合はDriverApplier型の
 *   シグネチャ拡張が必要(TODO、Phase 4着手時に要相談)。
 */
export function applyDrugDiscoveryDriver(
  inputs: DrugDiscoveryInputs,
  driverId: string,
  multiplier: number,
): DrugDiscoveryInputs {
  if (driverId === 'discountRate.base') {
    const DELTA_R = 0.02
    const sign = multiplier > 1 ? 1 : multiplier < 1 ? -1 : 0
    const value = Math.max(inputs.discountRate.base + sign * DELTA_R, 0.001)
    return { ...inputs, discountRate: { ...inputs.discountRate, base: value } }
  }

  const match = ASSET_DRIVER_RE.exec(driverId)
  if (!match) return inputs
  const index = Number(match[1])
  const subPath = match[2]
  const asset = inputs.assets[index]
  if (!asset) return inputs

  let updatedAsset: PipelineAsset
  if (subPath === 'peakSales') {
    updatedAsset = { ...asset, peakSales: Math.max(asset.peakSales * multiplier, 0) }
  } else if (subPath === 'launchYear') {
    updatedAsset = { ...asset, launchYear: Math.max(Math.round(asset.launchYear * multiplier), 1) }
  } else if (subPath.startsWith('phaseSuccessProbs.')) {
    const phase = subPath.slice('phaseSuccessProbs.'.length) as Phase
    const value = Math.min(Math.max(asset.phaseSuccessProbs[phase] * multiplier, 0), 1)
    updatedAsset = { ...asset, phaseSuccessProbs: { ...asset.phaseSuccessProbs, [phase]: value } }
  } else if (subPath === 'commercialization.contributionMargin' && asset.commercialization.type === 'own') {
    const value = Math.min(Math.max(asset.commercialization.contributionMargin * multiplier, 0), 1)
    updatedAsset = { ...asset, commercialization: { ...asset.commercialization, contributionMargin: value } }
  } else if (subPath === 'commercialization.royaltyRate' && asset.commercialization.type === 'license') {
    const value = Math.min(Math.max(asset.commercialization.royaltyRate * multiplier, 0), 1)
    updatedAsset = { ...asset, commercialization: { ...asset.commercialization, royaltyRate: value } }
  } else {
    return inputs
  }

  const assets = [...inputs.assets]
  assets[index] = updatedAsset
  return { ...inputs, assets }
}

export function drugDiscoveryBaseEv(inputs: DrugDiscoveryInputs): Money {
  const result = evaluateDrugDiscovery(inputs)
  return result.ok ? result.value.ev.base : Number.NaN
}
