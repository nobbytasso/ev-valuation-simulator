/**
 * 円形ゲージ(主要数値のメーター表示)。出典: docs/phase6-spec.md §4
 * SVG同心円リング(トラック+フィル)。色・線幅はすべて第2層トークン(--gauge-*)参照のみで、
 * テーマ条件分岐はコンポーネントに書かない(設計原則3)。回転アニメーション・確定演出は
 * theme-effects側からCSSクラスを付与する想定(§6)であり、ゲージ本体はアニメなしでも完結する。
 */
import { useEffect, useState } from 'react'
import type { StatusColor } from '../statusColor.ts'
import { useCountUp } from './useCountUp.ts'
import './CircularGauge.css'

export interface CircularGaugeProps {
  label: string
  /** 英字キャプション(§6.3。例: 'ENTERPRISE VALUE') */
  captionEn?: string
  /** カウントアップの対象となる生値 */
  value: number
  /** 中央に表示する確定済みの書式化済みテキスト(単位込み) */
  valueText: string
  /** リング充足率[0,1]。nullはリングを不定様式(トラックのみ)で描画する */
  ratio: number | null
  /** 判定色(§5)。ゲージ自身は判定しない。既定neutral */
  status?: StatusColor
  /** リング上に業界標準等の基準線を表示する場合のratio空間([0,1])位置 */
  markerRatio?: number
}

const RADIUS = 40
const STROKE_WIDTH = 10
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const COUNT_UP_DURATION_MS = 600

const STATUS_COLOR_VAR: Record<StatusColor, string> = {
  good: 'var(--color-status-good)',
  caution: 'var(--color-status-caution)',
  bad: 'var(--color-status-bad)',
  neutral: 'var(--gauge-fill)',
}

export function CircularGauge({ label, captionEn, value, valueText, ratio, status = 'neutral', markerRatio }: CircularGaugeProps) {
  const animatedValue = useCountUp(value, COUNT_UP_DURATION_MS)
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    setSettled(false)
    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = setTimeout(() => setSettled(true), prefersReducedMotion ? 0 : COUNT_UP_DURATION_MS)
    return () => clearTimeout(timer)
    // valueText自体は毎回変わりうるが、アニメーションの再スケジュールはvalue変化にのみ追従する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const displayText = settled ? valueText : animatedValue.toLocaleString('ja-JP', { maximumFractionDigits: 1 })
  const fillColor = STATUS_COLOR_VAR[status]
  const dashOffset = ratio === null ? CIRCUMFERENCE : CIRCUMFERENCE * (1 - ratio)

  return (
    <div className="circular-gauge">
      <svg className="circular-gauge__svg" viewBox="0 0 100 100" role="img" aria-label={`${label}: ${valueText}`}>
        <circle
          className="circular-gauge__track"
          cx="50"
          cy="50"
          r={RADIUS}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          stroke="var(--gauge-track)"
        />
        {ratio !== null && (
          <circle
            className="circular-gauge__fill"
            cx="50"
            cy="50"
            r={RADIUS}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            stroke={fillColor}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 50 50)"
          />
        )}
        {markerRatio !== undefined && ratio !== null && (
          <line
            className="circular-gauge__marker"
            x1="50"
            y1="50"
            x2={50 + RADIUS * Math.cos(2 * Math.PI * markerRatio - Math.PI / 2)}
            y2={50 + RADIUS * Math.sin(2 * Math.PI * markerRatio - Math.PI / 2)}
            stroke="var(--color-warning)"
            strokeWidth="1.5"
          />
        )}
        <text x="50" y="47" textAnchor="middle" className="circular-gauge__value tabular-numbers">
          {displayText}
        </text>
        <text x="50" y="62" textAnchor="middle" className="circular-gauge__label">
          {label}
        </text>
      </svg>
      {captionEn && <p className="circular-gauge__caption-en">{captionEn}</p>}
    </div>
  )
}
