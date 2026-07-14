/**
 * keyMetrics ラベル表(比較ビュー・Excelの表示語彙)。出典: docs/phase5-spec.md §1.2-1
 * 対象キーは現状: SaaS ruleOf40 / メディア avgLifetimeMonths・ltv・ltvCpaRatio・paybackMonths /
 * EC contributionMarginRatio・ltv・ltvCacRatio。医療機器・クライメート・創薬は現状空。
 */
import type { SectorId } from '../../store/scenarioTypes.ts'

/**
 * pt: 既にポイント換算済みの数値(×100不要、例: ruleOf40)
 * x: 倍率
 * months / years: 期間
 * yen: 円建て単価
 * ratio: 小数表現の比率(表示時に×100して%表記)
 */
export type KeyMetricFormat = 'pt' | 'x' | 'months' | 'years' | 'yen' | 'ratio'

export interface KeyMetricLabelEntry {
  label: string
  format: KeyMetricFormat
}

export type KeyMetricsLabelTable = Record<string, KeyMetricLabelEntry>

export const KEY_METRICS_LABELS: Record<SectorId, KeyMetricsLabelTable> = {
  saas_jp: {
    ruleOf40: { label: 'Rule of 40', format: 'pt' },
  },
  drug_discovery: {},
  medical_device: {},
  media_tech: {
    avgLifetimeMonths: { label: '平均顧客生存期間', format: 'months' },
    ltv: { label: 'LTV', format: 'yen' },
    ltvCpaRatio: { label: 'LTV/CPA比率', format: 'x' },
    paybackMonths: { label: 'CAC回収期間', format: 'months' },
  },
  ec_d2c: {
    contributionMarginRatio: { label: '貢献利益率', format: 'ratio' },
    ltv: { label: 'LTV', format: 'yen' },
    ltvCacRatio: { label: 'LTV/CAC比率', format: 'x' },
  },
  climate_tech: {},
}
