/**
 * カテゴリ別・単一系列の棒グラフ(共通コンポーネント)。出典: docs/v2-adoption-spec.md §6.2 C6。
 * V2投資ケースワークベンチのトップライン比較(4ケース)専用にせず、`src/ui/` に置いて再利用する。
 * 系列が1本のときは凡例を出さない(dataviz方針: 単一系列に凡例ボックスは不要、タイトルが系列を示す)。
 * トークン参照のみ(色は var(--color-accent) 固定、テーマ分岐をコンポーネントに書かない)。
 */
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface CategoryBarDatum {
  name: string
  value: number
}

export interface CategoryBarChartProps {
  data: CategoryBarDatum[]
  formatValue: (value: number) => string
  formatAxisValue?: (value: number) => string
  axisLabel?: string
  height?: number
}

export function CategoryBarChart({ data, formatValue, formatAxisValue, axisLabel, height = 260 }: CategoryBarChartProps) {
  if (data.length === 0) return null
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 16, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="name" stroke="var(--color-text-muted)" />
        <YAxis
          stroke="var(--color-text-muted)"
          tickFormatter={formatAxisValue ?? formatValue}
          label={
            axisLabel
              ? { value: axisLabel, position: 'insideTopLeft', fill: 'var(--color-text-muted)', fontSize: 11 }
              : undefined
          }
        />
        <Tooltip formatter={(value) => formatValue(Number(value))} />
        {/* バーは上限56pxの細身に保つ(CashflowChart.tsxと同じ方針)。 */}
        <Bar dataKey="value" fill="var(--color-accent)" maxBarSize={56} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
