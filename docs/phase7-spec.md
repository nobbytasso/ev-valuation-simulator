# Phase 7 設計書(phase7-spec)v1.0 — GitHub Pages デプロイ(Actions)+ ダミーデータ組込み

日付: 2026-07-15 / セッション: Phase 7-A(設計)
正とする文書: `docs/requirements-rev5.md` §2 Stage 1(GitHub Pages / 静的 / 外部送信なし)・§9 Phase 7 行(完了条件: 本番URL動作確認)
繰り越し判断: CI への E2E 組み込み(Phase 4 クローズ時から Phase 7 送り)

**運用注記**: ユーザーの事前授権(2026-07-15「裁定事項についてはレコメンドをまとめて、特に裁定事項がなければ Sonnet に実装をさせて完了したらレビューまで」)により、§2 の判断事項は推奨案を採用して実装まで進める。異論があれば受入時に指摘を受けて fix する。

---

## 0. 現状調査(設計の前提事実)

| 項目 | 事実 |
| --- | --- |
| リモート | `origin = https://github.com/nobbytasso/ev-valuation-simulator.git`。**ローカル main は origin より 96 コミット先行(Phase 4〜6 が未push)** |
| Pages URL(見込み) | `https://nobbytasso.github.io/ev-valuation-simulator/`(プロジェクトページ = サブパス配信) |
| ルーティング | HashRouter(Phase 2 で「SPAフォールバック設定なしで運用するため」と明記済み)→ **404.html フォールバック不要**。深いURLも index.html のみで動作 |
| ダミーデータ | `StaticJsonSource` は `benchmarks.dummy.json` を **ビルド時バンドル(import)**。実行時 fetch なし → ベースパス問題なし。**「ダミーデータ組込み」は実装済みであり、Phase 7 では dist に含まれることの確認のみ** |
| アセット参照 | `index.html` の `/favicon.svg` `/src/main.tsx` は Vite がビルド時に base で書き換える。Google Fonts は CDN(絶対URL)で影響なし |
| CI | `.github/workflows/` なし。gh CLI は未認証(リポジトリ公開設定・Pages 設定の確認/変更はユーザー側の操作) |
| E2E | `@playwright/test@1.61.1` + Chromium、29本。`webServer: npm run dev`(reuseExistingServer: true) |

## 1. 設計

### 1.1 Vite ベースパス — 相対 base(`'./'`)

`vite.config.ts` に `base: './'` を追加する。

- プロジェクトページのサブパス(`/ev-valuation-simulator/`)配信でもアセットが正しく解決される。
- **絶対パス案(`/ev-valuation-simulator/`)を採らない理由**: dev サーバー・E2E(`http://localhost:5173/#/` を29本が参照)がサブパス配信になり全滅するため、環境分岐(`process.env` 条件)が必要になる。相対 base なら dev / preview / Pages すべて無変更で動き、HashRouter(常に index.html 1枚)とも整合する。
- ビルド検証: `npm run build` 後、`dist/index.html` のアセット参照が `./assets/...` になっていること+`npm run preview` での動作確認。

### 1.2 GitHub Actions ワークフロー(`.github/workflows/deploy.yml` 1本)

公式 Pages アクション方式(gh-pages ブランチを作らない):

```
トリガー: push(main)+ workflow_dispatch
concurrency: group "pages"、cancel-in-progress: false(デプロイの取り消しはしない)
permissions: contents: read / pages: write / id-token: write

job quality(ubuntu-latest):
  actions/checkout → actions/setup-node(node 24, cache: npm) → npm ci
  → npm run typecheck → npm run lint → npm run test
  → npx playwright install --with-deps chromium → npm run test:e2e   ← 繰り越し判断(§2 R7-2)
job build(needs: quality):
  npm ci → npm run build → actions/configure-pages → actions/upload-pages-artifact(path: dist)
job deploy(needs: build, environment: github-pages):
  actions/deploy-pages → 本番URLへ curl で HTTP 200 スモーク
```

- E2E の `webServer`(`npm run dev` + reuseExistingServer)は CI 上でもそのまま機能する(既存サーバーがないため常に起動)。
- Node 24(2026年時点の LTS)。ローカルは v26 だが、`tsc -b` / vite 8 / vitest 4 は両対応。

### 1.3 受入(完了条件「本番URL動作確認」の運用)

デプロイ実行(push・Pages 有効化)は**ユーザーの GitHub 操作**を要するため、実装セッションはワークフロー整備+ローカル検証まで。受入手順は完了報告に記載する:

1. リポジトリ公開設定の確認(**private の場合、GitHub Pages は有料プランが必要**。public にするか判断はユーザー)
2. GitHub Settings → Pages → Source: **GitHub Actions** を選択
3. `git push origin main`(96コミット+Phase 7分。**このpushでコード全体が初公開される**)
4. Actions 完走後、`https://nobbytasso.github.io/ev-valuation-simulator/` で確認: 一覧表示(ダミーデータバッジ)/シナリオ作成→保存→リロード復元/両テーマ切替/Excelダウンロード/フォント読込

## 2. 判断事項と採用したレコメンド(R7-1〜R7-6)

| # | 論点 | 採用(推奨) | 不採用の代替案と理由 |
| --- | --- | --- | --- |
| R7-1 | ベースパス | **相対 base `'./'`** | 絶対サブパス: dev/E2E に環境分岐が必要になるだけで利点なし(§1.1) |
| R7-2 | **CI への E2E 組み込み(繰り越し判断)** | **組み込む**(deploy 前の品質ゲートに29本を必須で実行) | 除外: デプロイ毎の回帰保証が失われる。Chromium のみ・約1分のコストで、Phase 6 まで蓄積した29本の価値が最大化するのがまさにデプロイゲート |
| R7-3 | デプロイトリガー | **main への push + workflow_dispatch**(concurrency で直列化) | タグ/リリース駆動: 本プロジェクトは main 直コミット運用でリリース概念がなく過剰 |
| R7-4 | デプロイ方式 | **公式 Pages アクション**(configure/upload-pages-artifact/deploy-pages) | gh-pages ブランチ方式: ビルド成果物で履歴が汚れ、権限もPAT系になり劣る |
| R7-5 | CI Node | **24(LTS)** + npm ci + npm cache | ローカル同一の26: Actions の LTS 安定性を優先(依存はどちらでも動作) |
| R7-6 | デプロイ後確認 | **ワークフロー内 curl 200 スモーク+ユーザーの目視チェックリスト**(§1.3) | 本番E2E自動化: Stage 1 の規模では過剰。Phase 8/Stage 2 で再検討 |

いずれも慣用解であり金額計算・データの扱いに関わらないため、事前授権に基づき推奨案で実装に進む。**ただし §1.3-3 の push(コード初公開)だけはユーザー操作として残す**(外部公開の最終判断のため)。

## 3. 実装計画(Sonnet、2コミット)

| # | コミット | 内容 | 完了条件 |
| --- | --- | --- | --- |
| C1 | `feat(deploy): GitHub Pagesデプロイワークフロー` | `vite.config.ts` に base './'、`.github/workflows/deploy.yml` 新設(§1.2) | typecheck/lint/test/test:e2e Green(base変更の回帰確認)+ `npm run build` 成功 + dist/index.html の相対参照確認 + `npm run preview` で一覧・詳細・テーマ切替の実ブラウザ動作確認 + dist にベンチマークダミーデータがバンドルされていることの確認 |
| C2 | `docs: Phase 7 完了報告` | 実装内容+§1.3 受入手順(ユーザー向け)を docs/logs/ に保存 | — |

制約: エンジン・store・UI コンポーネント・テーマに触れない(変更は vite.config.ts の base 1行と workflow 新規のみ)。golden 差分なし。ワークフローの YAML は本書 §1.2 の構成に従う。

*v1.0 — 2026-07-15。Phase 7-A(Fable)。R7-1〜R7-6 は事前授権により推奨案採用で確定。*
