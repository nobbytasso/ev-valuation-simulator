/**
 * 計算エンジン共通の型定義。
 * 出典: docs/engine-spec.md §0
 *
 * このファイルは依存ゼロ(型定義のみ)。React・DOM・ストレージ・Date.now・Math.random は使用しない。
 */

/** 金額。単位: 百万円(JPY millions) */
export type Money = number

/** 比率。小数表現(0.25 = 25%)。UIでの%表示はUI層の責務 */
export type Ratio = number

/** 単価・顧客単位の金額。単位: 円。エンジン内で ÷ 1e6 して Money に換算 */
export type Yen = number

/** 評価基準時点(t = 0)からの経過年数。整数 */
export type YearIndex = number

/** 悲観/ベース/楽観の3点レンジ */
export interface Range3<T> {
  pessimistic: T
  base: T
  optimistic: T
}

export type EvRange = Range3<Money>

export interface ValidationIssue {
  field: string // 例: "discountRate"
  code: string // 例: "OUT_OF_DOMAIN", "TERMINAL_GROWTH_GTE_DISCOUNT"
  message: string // 日本語メッセージ
}

export type EngineResult<T> = { ok: true; value: T } | { ok: false; errors: ValidationIssue[] }

/** 全セクター共通の評価結果 */
export interface SectorValuationResult {
  ev: EvRange // 企業価値レンジ(百万円)
  auxiliary?: Money // 補助評価値(SaaSの簡易DCF等)。単一値
  keyMetrics: Record<string, number> // 自動算出指標(Rule of 40, LTV/CAC等)
  cashflows?: { t: YearIndex; cf: Money }[] // DCF系モデルの年次CF(チャート用)
}

/**
 * ゼロ除算回避のための相対誤差判定。golden fixture突合・fast-checkプロパティ双方で使用可能な
 * 共通ヘルパーとしてテストコードから参照する(spec本文に定義された式そのまま)。
 */
export function closeEnough(actual: number, expected: number, tol = 1e-9): boolean {
  return Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(expected))
}
