/**
 * 日英併記キャプション定数表(§6.3)。一般的な財務用語の英訳であり、発明ではない。
 * DOMには両テーマとも常設し、スタイルのみテーマで切替える(P6-6裁定。表示/非表示の
 * 切替はレイアウトシフト禁止則に抵触するため行わない)。
 */
export const SECTION_CAPTIONS = {
  result: 'ENTERPRISE VALUE',
  vcMethod: 'VC METHOD',
  capitalPolicy: 'CAPITAL POLICY',
  sensitivity: 'SENSITIVITY',
  benchmarkComparison: 'BENCHMARK COMPARISON',
  compare: 'COMPARISON',
  portfolio: 'PORTFOLIO',
  presets: 'PRESETS',
  inputDrivers: 'INPUT DRIVERS',
} as const

export type SectionCaptionKey = keyof typeof SECTION_CAPTIONS
