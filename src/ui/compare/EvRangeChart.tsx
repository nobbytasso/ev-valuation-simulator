import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { EvChartDatum } from './compareEngine.ts'

export interface EvRangeChartProps {
  data: EvChartDatum[]
}

function formatMoney(value: number): string {
  return `${value.toLocaleString('ja-JP', { maximumFractionDigits: 0 })} 百万円`
}

/**
 * EVレンジのグループ棒チャート(X=シナリオ、悲観/ベース/楽観の3系列)。出典: docs/phase5-spec.md §2.3
 * 判定色・凝った演出はPhase 6のスコープ。テーマトークンを参照する素朴な描画のみ。
 */
export function EvRangeChart({ data }: EvRangeChartProps) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 16, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="name" stroke="var(--color-text-muted)" />
        <YAxis stroke="var(--color-text-muted)" tickFormatter={(v: number) => v.toLocaleString('ja-JP')} />
        <Tooltip formatter={(value) => formatMoney(Number(value))} />
        <Legend />
        <Bar dataKey="pessimistic" name="悲観" fill="var(--color-status-bad)" />
        <Bar dataKey="base" name="ベース" fill="var(--color-accent)" />
        <Bar dataKey="optimistic" name="楽観" fill="var(--color-status-good)" />
      </BarChart>
    </ResponsiveContainer>
  )
}
