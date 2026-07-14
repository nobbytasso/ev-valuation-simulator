// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CashflowChart } from './CashflowChart.tsx'

afterEach(() => {
  cleanup()
})

describe('CashflowChart', () => {
  it('cashflowsが空配列のとき何も描画しない(D-16: 対象外セクターでの誤表示防止)', () => {
    const { container } = render(<CashflowChart cashflows={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('cashflowsがあるとき見出しとチャートを描画する', () => {
    render(
      <CashflowChart
        cashflows={[
          { t: 1, cf: -100 },
          { t: 2, cf: 50 },
          { t: 3, cf: 200 },
        ]}
      />,
    )
    expect(screen.getByText('年次キャッシュフロー')).toBeInTheDocument()
  })
})
