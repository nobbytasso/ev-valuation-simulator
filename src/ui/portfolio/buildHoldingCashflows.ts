/**
 * 銘柄1件分のキャッシュフロー列(§3.3)。出典: docs/phase5-spec.md §3.3
 *
 * 日付計算(投資日→評価基準日の年数換算)はUI層で完了させてから渡す
 * (エンジンには数値のみ渡す。new Date() はこの関数の外に閉じる)。
 * t は非負の実数(年フラクション)を許容する定義域拡張を利用する(engine-spec.md §0.1、Phase5追記)。
 */
import type { Cashflow, Money } from '../../engine/index.ts'

export function buildHoldingCashflows(investmentAmount: Money, marketValueBase: Money, yearsElapsed: number): Cashflow[] {
  return [
    { t: 0, cf: -investmentAmount },
    { t: yearsElapsed, cf: marketValueBase },
  ]
}
