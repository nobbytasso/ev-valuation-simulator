/**
 * 構成比の円チャート(共通コンポーネント)。出典: docs/v2-adoption-spec.md §6.3 C7。
 * 投資家リターンの内訳(投下資本回収分/超過リターン分/元本毀損分)・ポートフォリオの
 * 時価構成(銘柄別)の両方で使う(v2専用にしない)。値が0のスライスは表示しない。
 * 系列が2件以上のときは凡例を常時表示する(dataviz方針)。
 */
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

export interface CompositionSlice {
  name: string
  value: number
  /** トークン参照(例: 'var(--color-status-good)')。呼び出し側が意味に応じて割り当てる。 */
  color: string
}

export interface CompositionPieChartProps {
  data: CompositionSlice[]
  formatValue: (value: number) => string
  height?: number
}

export function CompositionPieChart({ data, formatValue, height = 260 }: CompositionPieChartProps) {
  const slices = data.filter((slice) => slice.value > 0)
  if (slices.length === 0) return null
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={slices}
          dataKey="value"
          nameKey="name"
          innerRadius="45%"
          outerRadius="80%"
          paddingAngle={slices.length > 1 ? 2 : 0}
        >
          {slices.map((slice) => (
            <Cell key={slice.name} fill={slice.color} stroke="var(--color-surface)" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => formatValue(Number(value))} />
        {slices.length > 1 && <Legend />}
      </PieChart>
    </ResponsiveContainer>
  )
}
