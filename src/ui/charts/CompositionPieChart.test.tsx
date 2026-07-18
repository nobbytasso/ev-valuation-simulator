// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CompositionPieChart } from './CompositionPieChart.tsx'

afterEach(() => {
  cleanup()
})

describe('CompositionPieChart', () => {
  it('全スライスが0以下のとき何も描画しない', () => {
    const { container } = render(
      <CompositionPieChart
        data={[
          { name: 'A', value: 0, color: 'var(--color-accent)' },
          { name: 'B', value: 0, color: 'var(--color-status-good)' },
        ]}
        formatValue={(v) => String(v)}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('値が正のスライスがあるとき例外なく描画する', () => {
    const { container } = render(
      <CompositionPieChart
        data={[
          { name: '投下資本の回収分', value: 800, color: 'var(--color-accent)' },
          { name: '超過リターン分', value: 400, color: 'var(--color-status-good)' },
        ]}
        formatValue={(v) => `${v}百万円`}
      />,
    )
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
  })
})
