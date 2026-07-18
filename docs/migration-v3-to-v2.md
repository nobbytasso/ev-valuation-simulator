# 旧Scenario v3からV2への移行

## 自動移行

V2画面の「JSONインポート」から旧Scenario JSONを読み込む。

自動移行対象:

- SaaS
- EC/D2C
- Media Tech
- Medical Device
- Drug Discovery
- Climate Tech

SaaS、EC/D2C、Media Techは旧入力から会社現在値とマルチプルレンジを読み取り、4ケースへ近似展開する。

共通VC法入力:

- targetMultiple
- yearsToExit
- investment
- dilutionRetention
- netDebtAtExit

は各V2ケースへ引き継ぐ。

## 手動確認が必要な理由

旧プリセットは会社の現在値まで固定値で置換していたため、その値が実在会社の入力かサンプル値かを機械的に判別できない。

移行後は必ず以下を確認する。

- 会社の現在ARR、売上、MAU等
- 提示Pre-money
- 完全希薄化後株式数
- Exitまでの年数
- Exitマルチプル
- Exit Net Debt
- 持分残存率
- 創薬・クライメートのCurrent Intrinsic Value
