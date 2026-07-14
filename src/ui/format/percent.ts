/**
 * Ratio(小数)→ %入力欄の表示値。出典: Phase 6 デザインレビュー指摘(2026-07-15)。
 * JSの浮動小数点では 0.07 * 100 = 7.000000000000001 のようなアーティファクトが出るため、
 * 入力欄の value に渡す直前に丸める(表示のみの変換。onChange 側の保存値には影響しない)。
 */
export function ratioToPercentInput(ratio: number): number {
  return Number((ratio * 100).toFixed(6))
}
