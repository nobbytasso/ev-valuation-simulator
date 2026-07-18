# EV Valuation Simulator

VC投資のための、セクター別企業価値・投資リターンシミュレーター。

## V2 Investment Case Workbench

V2では、会社の現在値と将来シナリオを分離し、以下の4ケースを横比較する。

- 会社計画
- 引受ケース
- Downside
- Severe Downside

計算フロー:

```text
Exit KPI
→ Exit Enterprise Value
→ Exit Equity Value
→ Current Allowable Post-money
→ Current Allowable Pre-money
→ Theoretical Share Price
→ Expected IRR / MOIC
```

対応セクター:

- SaaS
- 創薬
- 医療機器
- メディアテック
- EC/D2C
- クライメートテック

## 開発

```bash
npm install
npm run dev
```

検証:

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

## ルート

- `/`: V2 Investment Case Workbench
- `/legacy`: 旧Scenario UI
- `/portfolio`: 既存ポートフォリオ
- `/compare`: 旧シナリオ比較

## ドキュメント

- `docs/redesign-v2.md`
- `docs/v2-calculation-manual.md`
- `docs/migration-v3-to-v2.md`
- `docs/full-analysis.md`
- `docs/v2-validation-report.md`
- `docs/engine-spec.md`

## データ

V2はブラウザのlocalStorageへ保存する。

```text
ev-valuation-simulator:workbench:v2
```

JSONインポート・エクスポート、Excelエクスポートに対応する。
