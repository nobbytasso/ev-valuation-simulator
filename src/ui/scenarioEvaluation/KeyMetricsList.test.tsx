// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { KeyMetricsList } from './KeyMetricsList.tsx'

describe('KeyMetricsList', () => {
  it('keyMetricsがundefinedのとき何も表示しない(入力エラー中)', () => {
    const { container } = render(<KeyMetricsList sector="saas_jp" keyMetrics={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('KEY_METRICS_LABELSに登録された全キーを表示する(SaaS: ruleOf40)', () => {
    render(<KeyMetricsList sector="saas_jp" keyMetrics={{ ruleOf40: 35 }} />)
    expect(screen.getByText(/Rule of 40: 35\.0 pt/)).toBeInTheDocument()
  })

  it('メディアはpaybackMonthsを含む4キー全件を表示する(B-2: 従来非表示だったキーの解消)', () => {
    render(
      <KeyMetricsList
        sector="media_tech"
        keyMetrics={{ avgLifetimeMonths: 12.5, ltv: 30000, ltvCpaRatio: 2.97, paybackMonths: 8.2 }}
      />,
    )
    expect(screen.getByText(/平均顧客生存期間: 12\.5月/)).toBeInTheDocument()
    expect(screen.getByText(/LTV: 30,000円/)).toBeInTheDocument()
    expect(screen.getByText(/LTV\/CPA比率: 2\.97x/)).toBeInTheDocument()
    expect(screen.getByText(/CAC回収期間: 8\.2月/)).toBeInTheDocument()
  })

  it('登録テーブルが空のセクター(創薬)は何も表示しない', () => {
    const { container } = render(<KeyMetricsList sector="drug_discovery" keyMetrics={{}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('テーブルにあってもkeyMetricsに値がないキーはスキップする', () => {
    render(<KeyMetricsList sector="ec_d2c" keyMetrics={{ contributionMarginRatio: 0.2 }} />)
    expect(screen.getByText('貢献利益率: 20.0%')).toBeInTheDocument()
    expect(screen.queryByText(/LTV\/CAC比率/)).not.toBeInTheDocument()
  })
})
