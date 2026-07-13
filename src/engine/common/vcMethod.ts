/**
 * VC法(共通オーバーレイ)。
 * 出典: docs/engine-spec.md §1.2
 *
 * 依存ゼロの純粋関数のみ。
 */
import type { Money, Ratio } from '../types.ts'

export interface VcMethodInputs {
  exitEnterpriseValue: Money // Exit時企業価値(セクターモデルの出力を接続)
  netDebtAtExit: Money // 既定 0(→ U-12)
  targetMultiple: number // 目標倍率(> 0)。例: 10
  yearsToExit: number // > 0
  investment: Money // 今回投資額
  dilutionRetention: Ratio // Exit時までの持分残存率(0,1]。希薄化シムから接続、手入力も可
}

export interface VcMethodResult {
  exitEquityValue: Money // = exitEV − netDebt
  impliedPostMoneyNow: Money // 現在の許容ポストマネー
  impliedIrr: Ratio // 目標倍率が含意するIRR
  requiredOwnershipAtExit: Ratio // Exit時必要持分
  requiredOwnershipAtEntry: Ratio // 投資時必要持分(希薄化考慮)
  /**
   * requiredOwnershipAtEntry > 1 は「その条件では成立しない」ことを示すフラグ(§1.2境界条件)。
   * エラー(ok: false)にはせず、常に ok: true の結果としてこのフラグをUI層に返す。
   */
  isInfeasible: boolean
}

export function computeVcMethod(inputs: VcMethodInputs): VcMethodResult {
  const exitEquityValue = inputs.exitEnterpriseValue - inputs.netDebtAtExit
  const impliedPostMoneyNow = exitEquityValue / inputs.targetMultiple
  const impliedIrr = Math.pow(inputs.targetMultiple, 1 / inputs.yearsToExit) - 1
  const requiredOwnershipAtExit = (inputs.investment * inputs.targetMultiple) / exitEquityValue
  const requiredOwnershipAtEntry = requiredOwnershipAtExit / inputs.dilutionRetention

  return {
    exitEquityValue,
    impliedPostMoneyNow,
    impliedIrr,
    requiredOwnershipAtExit,
    requiredOwnershipAtEntry,
    isInfeasible: requiredOwnershipAtEntry > 1,
  }
}
