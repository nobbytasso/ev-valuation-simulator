// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CategoryBarChart } from './CategoryBarChart.tsx'

afterEach(() => {
  cleanup()
})

describe('CategoryBarChart', () => {
  it('dataが空配列のとき何も描画しない', () => {
    const { container } = render(<CategoryBarChart data={[]} formatValue={(v) => String(v)} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('dataがあるとき例外なく描画する', () => {
    const { container } = render(
      <CategoryBarChart
        data={[
          { name: '会社計画', value: 1000 },
          { name: '引受ケース', value: 700 },
        ]}
        formatValue={(v) => `${v}百万円`}
      />,
    )
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
  })
})
