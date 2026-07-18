# V2 再設計仕様書

## 1. 目的

現行の「1保存シナリオの内部に悲観・ベース・楽観を持つ」構造を廃し、同一会社に対する独立した投資ケースを横比較する。

標準ケース:

1. 会社計画
2. 引受ケース
3. Downside
4. Severe Downside

## 2. 設計原則

- 会社固有の現在値と、ケースごとの将来仮定を分離する
- 現在価値、NTM価値、Exit価値を混同しない
- 1ケースは1本の事業・評価・投資リターンストーリーとする
- Exit KPIから理論株価まで共通Valuation Bridgeで接続する
- DCF/rNPV型セクターはCurrent Intrinsic ValueとExit Return Caseを分離する
- 既存のテーマ、CI、旧エンジン、ポートフォリオ画面は移行期間中維持する

## 3. 新ドメイン

```text
WorkbenchState
├─ CompanyProfile
└─ InvestmentCase[4]
```

### CompanyProfile

- 会社名
- セクター
- 評価基準日
- 完全希薄化後株式数
- 提示Pre-money
- 現在Net Debt
- セクター固有の現在値

### InvestmentCase

- ケース名・説明
- Exitルート
- Exitまでの年数
- 目標MOIC
- 投資額
- 持分残存率
- Exit Net Debt
- セクター固有の事業・評価前提

## 4. 共通Valuation Bridge

```text
Exit KPI
× Exit Multiple
= Exit Enterprise Value
- Exit Net Debt
= Exit Equity Value
÷ Target MOIC
= Current Allowable Post-money
- Investment Amount
= Current Allowable Pre-money
÷ Fully Diluted Shares
= Theoretical Share Price
```

提示条件からの順算:

```text
Investment / (Proposed Pre-money + Investment)
= Entry Ownership

Entry Ownership × Dilution Retention
= Exit Ownership

Exit Equity Value × Exit Ownership
= Expected Proceeds

Expected Proceeds / Investment
= Expected MOIC
```

## 5. セクター別ロジック

- SaaS: Exit ARR × EV/ARR
- EC/D2C: Exit RevenueまたはExit Gross Profit × Multiple
- Media Tech: Exit MAU × Exit ARPU × 12 × EV/Sales
- Medical Device: Current market-penetration DCF + Exit Revenue × EV/Sales
- Drug Discovery: Current rNPV + Exit risk-adjusted economic value
- Climate Tech: Current Project NPV + Exit risk-adjusted EBITDA × EV/EBITDA

## 6. UI

ルート `/` をV2 Investment Case Workbenchへ変更する。

旧機能:

- `/legacy`: 旧シナリオ一覧
- `/scenarios/:id`: 旧シナリオ詳細
- `/compare`: 旧比較
- `/portfolio`: 既存ポートフォリオ

## 7. 永続化

新キー:

```text
ev-valuation-simulator:workbench:v2
```

旧Scenario JSONをインポートした場合は自動移行し、確認通知を表示する。

## 8. 移行方針

V2を新規デフォルト画面として提供し、旧機能を即時削除しない。投資実務での検証後、PortfolioおよびBenchmarkをV2 Case IDへ接続する。
