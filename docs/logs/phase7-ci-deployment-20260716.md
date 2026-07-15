# Phase 7 CI デバッグと本番デプロイ完了の記録

日付: 2026-07-15〜16 / 実施: Fable セッション(push はユーザー授権に基づく)
前提: `docs/logs/phase7-completion-report-20260715.md`(実装)・`docs/logs/phase7-implementation-review-20260715.md`(レビュー承認)

## 1. 経緯(Actions run #1〜#6)

| Run | head | 結果 | 内容 |
| --- | --- | --- | --- |
| #1 | `6e04fa1` | quality/E2E失敗 | ユーザーの初回push。E2E testsステップのみ失敗(他は成功)。ローカルではTZ=UTC CI=1でも29本Greenで、CI環境固有と切り分け |
| #2 | `c53d10a` | 同上 | 診断整備: 失敗時playwright-report/test-resultsのアーティファクト保存、CI時retries=2+trace on-first-retry、reuseExistingServer=!CI、checkout/setup-node v5(Node20非推奨警告解消)。リトライ2回でも失敗=決定的failureと確定 |
| #3 | `271030b` | 同上 | Playwright githubレポーター有効化 → check-runアノテーション(未認証の公開APIで取得可)から**失敗テストを特定**: C2-1 テーマ切替レイアウトシフト、`.sector-scenario-view > section[4]` の y 差 12px(許容6px。x/widthは±1pxでパス) |
| #4 | `45bea65` | **quality成功**/build失敗 | **真因修正**: Hiraginoが無いLinuxでは本文書体がテーマ毎に別フォールバックへ分岐し、`line-height: normal` の書体依存差がセクション高として下方向に累積 → `base.css` で本文 `line-height: 1.6` を明示(見出しの1.3と同種の対策、両テーマ共通)。**テスト許容値は緩めず製品側で解決**。buildは Configure Pages で失敗(Pagesサイト未作成) |
| #5 | `2c0b4e1` | 同上 | `configure-pages` に `enablement: true` を試行 → **Pagesサイトの新規作成はリポジトリ管理者権限が必要で、GITHUB_TOKENでは不可**と確認(Pages API 404)。ユーザーに Settings→Pages→Source: GitHub Actions の設定を依頼 |
| #6 | `dc74d07` | **全ジョブ成功** | ユーザーがPages有効化 → quality(typecheck/lint/vitest 475件/E2E 29本)→ build → deploy(curl 200スモーク含む)完走 |

## 2. 本番URL検証(2026-07-16、Chromium実ブラウザ)

`https://nobbytasso.github.io/ev-valuation-simulator/`

- HTTP **200**
- シナリオ一覧描画・**ダミーデータバッジ表示**
- シナリオ新規作成 → 詳細ページ描画(ゲージ・チャート含む)
- テーマ切替動作(data-theme: dark→light)
- **コンソールエラー 0件**

## 3. 得られた知見(次回のCI障害切り分け用)

- 未認証でも取得可能: jobs API(ステップ単位の成否)・check-runs annotations(githubレポーター経由の失敗テスト名+スタック)。取得不可: ジョブログ・アーティファクトDL(要認証)
- ubuntuランナーはHiragino等のmacフォントが無く、テーマ毎フォント指定のフォールバック分岐が**macでは再現しないレイアウト差**を生む。行送りは明示的な line-height で書体非依存にするのが正解(見出し1.3・本文1.6で対策済み)
- Pagesサイトの初回作成は管理者の手動操作(Settings→Pages→Source: GitHub Actions)が必須。作成後は `enablement: true` は無害な素通り

## 4. 残タスク

- ユーザーによる本番URLの最終目視確認(受入チェックリスト: 保存→リロード復元 / 両テーマ / Excelダウンロード / フォント)→ OK受領で requirements-rev5.md §9 Phase 7 行に完了マーカーを反映しクローズ(**Stage 1 全フェーズ完了**となる)
