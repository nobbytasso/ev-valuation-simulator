import { Bar, BarChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import type { BenchmarkUnit } from '../adapters/benchmarks/types.ts'
import { formatDiff, formatValue } from './benchmarkFormat.ts'
import type { MetricDirection } from './statusColor.ts'
import { benchmarkStatus } from './statusColor.ts'
import './BenchmarkBar.css'

export interface BenchmarkComp {
  name: string
  value: number
}

export interface BenchmarkBarProps {
  label: string
  unit: BenchmarkUnit
  currentValue: number
  industryStandard?: number
  comps?: BenchmarkComp[]
  /** unit派生の既定サフィックスを上書きする(D-14。BenchmarkMetricConfig.unitSuffix由来)。 */
  unitSuffix?: string
  /** 判定色の極性(§5)。BenchmarkMetricConfig.direction由来。 */
  direction: MetricDirection
}

/**
 * 指標のゲージ/バーチャートに、業界標準値・比較対象企業を基準線(マーカーライン)として
 * 重畳表示する。出典: docs/requirements-rev4.md §4.1.2
 */
export function BenchmarkBar({ label, unit, currentValue, industryStandard, comps = [], unitSuffix, direction }: BenchmarkBarProps) {
  const allValues = [currentValue, industryStandard, ...comps.map((c) => c.value)].filter(
    (v): v is number => v !== undefined,
  )
  const maxValue = Math.max(...allValues, 0)
  const minValue = Math.min(...allValues, 0)
  const padding = (maxValue - minValue) * 0.15 || 1
  const domain: [number, number] = [minValue - padding, maxValue + padding]

  const diff = industryStandard !== undefined ? currentValue - industryStandard : undefined
  const status = industryStandard !== undefined ? benchmarkStatus(currentValue, industryStandard, direction) : 'neutral'

  return (
    <div className="benchmark-bar">
      <div className="benchmark-bar__header">
        <span className="benchmark-bar__label">{label}</span>
        <span className="benchmark-bar__value tabular-numbers">{formatValue(currentValue, unit, unitSuffix)}</span>
        {diff !== undefined && (
          <span className={`benchmark-bar__diff benchmark-bar__diff--${status}`}>
            業界標準比 {formatDiff(diff, unit, unitSuffix)}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={56}>
        <BarChart data={[{ name: label, value: currentValue }]} layout="vertical" margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <XAxis type="number" domain={domain} hide />
          <YAxis type="category" dataKey="name" hide />
          <Bar dataKey="value" fill="var(--color-accent)" radius={2} barSize={16} />
          {industryStandard !== undefined && (
            <ReferenceLine
              x={industryStandard}
              stroke="var(--color-warning)"
              strokeDasharray="4 4"
              label={{ value: '業界標準', position: 'top', fill: 'var(--color-warning)', fontSize: 11 }}
            />
          )}
          {comps.map((comp) => (
            <ReferenceLine
              key={comp.name}
              x={comp.value}
              stroke="var(--color-status-good)"
              strokeDasharray="2 2"
              label={{ value: comp.name, position: 'insideTopRight', fill: 'var(--color-status-good)', fontSize: 11 }}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
