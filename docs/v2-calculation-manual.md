# V2 計算マニュアル

## 共通

金額単位は百万円。完全希薄化後株式数は百万株で入力するため、百万円 ÷ 百万株 = 円/株となる。

### 現在の許容価値

```text
Exit Equity Value = Exit EV - Exit Net Debt
Current Allowable Post-money = Exit Equity Value / Target MOIC
Current Allowable Pre-money = Current Allowable Post-money - Investment
Theoretical Share Price = Current Allowable Pre-money / Fully Diluted Shares
```

### 提示条件での期待リターン

```text
Entry Ownership = Investment / (Proposed Pre-money + Investment)
Exit Ownership = Entry Ownership × Dilution Retention
Expected Proceeds = Exit Equity Value × Exit Ownership
Expected MOIC = Expected Proceeds / Investment
Expected IRR = Expected MOIC^(1 / Years to Exit) - 1
```

## SaaS

```text
Growth(t) = Initial Growth × Growth Decay^(t-1)
ARR(t) = ARR(t-1) × (1 + Growth(t))
Exit EV = Exit ARR × Exit EV/ARR
```

Rule of 40はExit年成長率 + Exit営業利益率。

## EC/D2C

```text
Revenue(t) = Revenue(t-1) × (1 + Growth(t))
Exit Gross Profit = Exit Revenue × Exit Gross Margin
Exit EV = Selected Basis × Exit Multiple
```

Selected BasisはExit RevenueまたはExit Gross Profit。

## Media Tech

```text
Exit MAU = Current MAUの成長投影
Exit ARPU = Current Monthly ARPUの成長投影
Exit Revenue = Exit MAU × Exit Monthly ARPU × 12 / 1,000,000
Exit EV = Exit Revenue × EV/Sales
```

## Medical Device

現在価値:

```text
Procedures(t) = Current Procedures × (1 + Growth)^t
Penetration(t) = launch前0、launch後はYears to Peakまで線形上昇
Revenue(t) = Procedures(t) × Penetration(t) × Price / (1 - Recurring Ratio)
FCF(t) = Revenue(t) × Operating Margin
Current Intrinsic Value = PV(FCF) + PV(Terminal Value)
```

Exit価値:

```text
Exit EV = Exit Revenue × EV/Sales
```

DCF現在価値をExit EVとしてVC法へ再投入しない。

## Drug Discovery

現在価値は案件固有rNPVを入力する。

簡易Exitイベント価値:

```text
Peak Sales at Exit = Current Peak Sales × (1 + Growth)^Years
Risk-adjusted Economic Value = Peak Sales at Exit × POS at Exit × Value Capture Rate
Exit EV = Risk-adjusted Economic Value × Transaction Multiple
```

導出、M&A、IPOの契約条件に応じて調整する。

## Climate Tech

現在価値は案件固有Project NPVを入力する。

```text
Realized Volume = Capacity × (Offtake Coverage + (1-Offtake) × Merchant Realization)
Unit Cost at Exit = Current Unit Cost × (1 - Cost Decline)^Years
EBITDA = Realized Volume × (Unit Price - Unit Cost at Exit)
         + Carbon Revenue - Fixed Opex
Risk-adjusted EBITDA = EBITDA × Mass Production Probability
Exit EV = Risk-adjusted EBITDA × EV/EBITDA
```
