// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CircularGauge } from './CircularGauge.tsx'

afterEach(() => {
  cleanup()
})

describe('CircularGauge', () => {
  it('ラベル・確定値をaria-labelに含める(role=img)', () => {
    render(<CircularGauge label="企業価値(ベース)" value={10400} valueText="10,400 百万円" ratio={0.5} />)
    expect(screen.getByRole('img', { name: '企業価値(ベース): 10,400 百万円' })).toBeInTheDocument()
  })

  it('ratio=nullのときフィルリングを描画しない(不定様式・トラックのみ)', () => {
    const { container } = render(<CircularGauge label="x" value={0} valueText="—" ratio={null} />)
    expect(container.querySelector('.circular-gauge__track')).toBeInTheDocument()
    expect(container.querySelector('.circular-gauge__fill')).not.toBeInTheDocument()
  })

  it('status指定時はfill circleのstrokeに対応する判定色トークンを使う', () => {
    const { container } = render(<CircularGauge label="x" value={1} valueText="1x" ratio={0.9} status="bad" />)
    const fill = container.querySelector('.circular-gauge__fill')
    expect(fill).toHaveAttribute('stroke', 'var(--color-status-bad)')
  })

  it('status未指定はneutral(--gauge-fill)を使う', () => {
    const { container } = render(<CircularGauge label="x" value={1} valueText="1x" ratio={0.9} />)
    const fill = container.querySelector('.circular-gauge__fill')
    expect(fill).toHaveAttribute('stroke', 'var(--gauge-fill)')
  })

  it('captionEnが指定されたときのみ英字キャプションを描画する(§6.3)', () => {
    const { rerender, container } = render(<CircularGauge label="企業価値" value={1} valueText="1x" ratio={0.5} />)
    expect(container.querySelector('.circular-gauge__caption-en')).not.toBeInTheDocument()

    rerender(<CircularGauge label="企業価値" captionEn="ENTERPRISE VALUE" value={1} valueText="1x" ratio={0.5} />)
    expect(screen.getByText('ENTERPRISE VALUE')).toBeInTheDocument()
  })
})
