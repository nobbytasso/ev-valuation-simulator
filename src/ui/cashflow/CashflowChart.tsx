/**
 * 年次CFチャート(D-16消化)。出典: docs/phase6-spec.md §7 D-16、P6-7裁定
 * SaaS・医療機器・クライメートの結果セクションに追加(cashflowsを返す3セクターのみ)。
 * エンジンの既存出力(cashflows)を消費するのみで、エンジン・store側には触れない。
 * 正負で色分け(判定色トークン)、軸は単位切替(useMoneyUnit)に連動する。
 */
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatMoney, formatMoneyValue, moneyAxisLabel } from '../format/money.ts'
import { useMoneyUnit } from '../format/useMoneyUnit.ts'

export interface CashflowChartProps {
  cashflows: { t: number; cf: number }[]
}

export function CashflowChart({ cashflows }: CashflowChartProps) {
  const { unit } = useMoneyUnit()
  if (cashflows.length === 0) return null

  const data = cashflows.map((c) => ({ year: `${c.t}年目`, cf: c.cf }))

  return (
    <div className="cashflow-chart">
      <h3>年次キャッシュフロー</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="year" stroke="var(--color-text-muted)" />
          <YAxis
            stroke="var(--color-text-muted)"
            tickFormatter={(v: number) => formatMoneyValue(v, unit)}
            label={{ value: moneyAxisLabel(unit), position: 'insideTopLeft', fill: 'var(--color-text-muted)', fontSize: 11 }}
          />
          <ReferenceLine y={0} stroke="var(--color-text-muted)" />
          <Tooltip formatter={(value) => formatMoney(Number(value), unit)} />
          <Bar dataKey="cf" name="年次CF">
            {data.map((d) => (
              <Cell key={d.year} fill={d.cf >= 0 ? 'var(--color-status-good)' : 'var(--color-status-bad)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
