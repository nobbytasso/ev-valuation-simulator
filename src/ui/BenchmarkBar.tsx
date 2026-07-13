import { Bar, BarChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import type { BenchmarkUnit } from '../adapters/benchmarks/types.ts'
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
}

function formatValue(value: number, unit: BenchmarkUnit): string {
  if (unit === 'percent') return `${value.toFixed(1)}%`
  if (unit === 'x_multiple') return `${value.toFixed(1)}x`
  if (unit === 'ratio') return value.toFixed(2)
  return value.toLocaleString('ja-JP')
}

function formatDiff(diff: number, unit: BenchmarkUnit): string {
  const sign = diff >= 0 ? '+' : ''
  if (unit === 'percent') return `${sign}${diff.toFixed(1)}pt`
  if (unit === 'x_multiple') return `${sign}${diff.toFixed(1)}x`
  if (unit === 'ratio') return `${sign}${diff.toFixed(2)}`
  return `${sign}${diff.toLocaleString('ja-JP')}`
}

/**
 * 指標のゲージ/バーチャートに、業界標準値・比較対象企業を基準線(マーカーライン)として
 * 重畳表示する。出典: docs/requirements-rev4.md §4.1.2
 */
export function BenchmarkBar({ label, unit, currentValue, industryStandard, comps = [] }: BenchmarkBarProps) {
  const allValues = [currentValue, industryStandard, ...comps.map((c) => c.value)].filter(
    (v): v is number => v !== undefined,
  )
  const maxValue = Math.max(...allValues, 0)
  const minValue = Math.min(...allValues, 0)
  const padding = (maxValue - minValue) * 0.15 || 1
  const domain: [number, number] = [minValue - padding, maxValue + padding]

  const diff = industryStandard !== undefined ? currentValue - industryStandard : undefined

  return (
    <div className="benchmark-bar">
      <div className="benchmark-bar__header">
        <span className="benchmark-bar__label">{label}</span>
        <span className="benchmark-bar__value tabular-numbers">{formatValue(currentValue, unit)}</span>
        {diff !== undefined && (
          <span
            className={`benchmark-bar__diff ${diff >= 0 ? 'benchmark-bar__diff--good' : 'benchmark-bar__diff--bad'}`}
          >
            業界標準比 {formatDiff(diff, unit)}
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
