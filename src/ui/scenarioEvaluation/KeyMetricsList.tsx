/**
 * keyMetrics統一表示(B-2)。出典: docs/phase6-spec.md §7
 * 各セクターのScenarioViewがアドホックに一部のみ表示していたのを解消し、
 * KEY_METRICS_LABELS(Phase 5 C2で導入済み)にあるキー全件を共通表示する。
 * Excel(全キー出力済み)と画面の粒度を一致させる。
 */
import type { SectorId } from '../../store/scenarioTypes.ts'
import { formatKeyMetricValue } from './keyMetricsFormat.ts'
import { KEY_METRICS_LABELS } from './keyMetricsLabels.ts'

export interface KeyMetricsListProps {
  sector: SectorId
  /** undefinedの場合(入力エラー中)は何も表示しない */
  keyMetrics: Record<string, number> | undefined
}

export function KeyMetricsList({ sector, keyMetrics }: KeyMetricsListProps) {
  if (!keyMetrics) return null
  const table = KEY_METRICS_LABELS[sector]
  const entries = Object.entries(table).filter(([key]) => typeof keyMetrics[key] === 'number')
  if (entries.length === 0) return null

  // <li>直下に単一のテキストノード列として展開する(ラベル/値を別要素に分けない)。
  // 別要素(<strong>等)に分けるとtesting-libraryのgetByTextが要素境界をまたいで
  // マッチできなくなり、既存の "ラベル: 値" 形式のテスト(例: SaasScenarioView.test.tsx)を壊すため。
  return (
    <ul className="key-metrics-list">
      {entries.map(([key, { label, format }]) => (
        <li key={key}>
          {label}: {formatKeyMetricValue(keyMetrics[key], format)}
        </li>
      ))}
    </ul>
  )
}
