# Phase 7 実装 完了報告

日付: 2026-07-15
指示元: `docs/phase7-spec.md`(GitHub Pages デプロイ設計、v1.0)。判断事項 R7-1〜R7-6 は事前授権により推奨案採用で確定済み(spec §2)。
対象: GitHub Pages デプロイワークフロー整備(base パス・Actions ワークフロー)+完了報告。C1・C2の全コミット完了。

---

## コミット一覧(§3 C1〜C2)

| # | コミット | 内容 |
| --- | --- | --- |
| C1 | `feat(deploy): GitHub Pagesデプロイワークフロー` | `vite.config.ts` に `base: './'` を追加(相対base、spec §1.1)。`.github/workflows/deploy.yml` を新設(quality→build→deployの3ジョブ、spec §1.2) |
| C2 | 本報告 | 実装内容・検証結果・ユーザー向け受入手順(spec §1.3)を記載 |

エンジン・store・UIコンポーネント・テーマは無変更(制約どおり、変更は `vite.config.ts` の base 1行と workflow 新規のみ)。golden fixture は無変更(差分なし)。

---

## 実装内容

### vite.config.ts — 相対base

```diff
 export default defineConfig({
+  base: './',
   plugins: [react()],
```

プロジェクトページのサブパス配信(`https://nobbytasso.github.io/ev-valuation-simulator/`)でもアセットが正しく解決されるよう相対baseを採用(spec R7-1)。dev サーバー・`npm run preview`・E2E(`http://localhost:5173/`)は無変更で動作する。

### .github/workflows/deploy.yml — 新設

spec §1.2 の構成に忠実に実装。

- **トリガー**: `push`(main)+ `workflow_dispatch`。`concurrency: group: pages, cancel-in-progress: false`。`permissions: contents: read / pages: write / id-token: write`
- **job quality**: `actions/checkout@v4` → `actions/setup-node@v4`(node-version: 24, cache: npm)→ `npm ci` → `npm run typecheck` → `npm run lint` → `npm run test` → `npx playwright install --with-deps chromium` → `npm run test:e2e`
- **job build**(needs: quality): `npm ci` → `npm run build` → `actions/configure-pages@v5` → `actions/upload-pages-artifact@v3`(path: dist)
- **job deploy**(needs: build, environment: github-pages, url は `deploy-pages` の出力を参照): `actions/deploy-pages@v4` → デプロイURLへ `curl` でHTTP 200を確認するステップ(非200時は exit 1 でジョブ失敗)

E2E の `webServer`(`npm run dev` + `reuseExistingServer: true`、`playwright.config.ts`)はCI上でも既存サーバーがないため常に起動し、変更なしでそのまま機能する。

---

## 検証結果(C1完了条件)

| 検証項目 | 結果 |
| --- | --- |
| `npm run typecheck` | Green |
| `npm run lint` | Green(oxlint exit code 0。`ScenarioComparePage.tsx`・`PortfolioPage.tsx`の既存警告4件のみ、Phase 6から継続の意図的パターンで対応不要) |
| `npm run test` | **475件 Green**(51ファイル) |
| `npm run test:e2e` | **29本 Green**(Bashサンドボックス内でChromiumが既導入済みのため、サンドボックス無効化なしで実行できた) |
| `npm run build` | 成功。警告はチャンクサイズ(1.1MB)のみで既存事象、Phase 7の変更とは無関係 |
| `dist/index.html` のアセット参照 | `<script src="./assets/index-BcPrnlqi.js">` / `<link href="./assets/index-EO04LGyi.css">` / `<link rel="icon" href="./favicon.svg">` すべて `./` 始まりの相対参照であることを確認 |
| dist内のダミーデータバンドル確認 | `grep -o '.\{30\}dummy.\{30\}' dist/assets/index-*.js` で6セクター全件の `data_status:"dummy"` がJSバンドル内に含まれることを確認(SaaS/創薬/医療機器/メディアテック/EC・D2C/クライメートテック) |
| `npm run preview` 実ブラウザ確認 | Playwright(`/Users/nmorii/.npm/_npx/e41f203b7505f1fb/node_modules/playwright`)で `http://localhost:4173` に対し実施。一覧表示(シナリオ一覧見出し+ダミーデータバッジ表示)→シナリオ新規作成(SaaS日本)→詳細表示(「結果」見出し表示)→テーマ切替(`data-theme` が `dark`→`light` に変化)を **コンソールエラー・pageerrorゼロ**で確認。確認後 `lsof -ti :4173 \| xargs kill` でpreviewサーバーを停止(停止後の接続確認で `curl` が接続拒否になることを確認) |

---

## ユーザー向け受入手順(spec §1.3)

実装セッションはワークフロー整備とローカル検証までであり、**デプロイの実行(push・Pages有効化)はユーザーのGitHub操作が必要**です。以下の手順で受け入れてください。

### 1. リポジトリ公開設定の確認

現在のリポジトリ `nobbytasso/ev-valuation-simulator` が **private** の場合、GitHub Pages の利用には有料プランが必要です。public にするかどうかはユーザー判断です(コードは Stage 1 の設計原則どおり、入力データはブラウザ外に一切送信されない静的アプリのため、公開自体によるデータ漏洩リスクはありません)。

### 2. GitHub Settings → Pages → Source: GitHub Actions

リポジトリの `Settings` → `Pages` タブで、Source を **GitHub Actions** に設定してください(gh-pagesブランチ方式ではなく、本ワークフローが自動でデプロイします)。

### 3. `git push origin main`

```
git push origin main
```

**重要**: ローカル main は origin より **96コミット + Phase 7分**先行しています。このpushで、Phase 1〜7のコード全体が初めて外部(GitHub)に公開されます。push前に、公開して問題ない内容であることを最終確認してください(このタスクではCLAUDE.mdの禁止事項に従い、実装セッション側からのpushは行っていません)。

push後、Actions タブでワークフロー(`Deploy to GitHub Pages`)が自動起動します。quality → build → deploy の順に実行され、quality ジョブで typecheck/lint/test(475件)/test:e2e(29本)が再実行されます。

### 4. 本番URL動作チェックリスト

Actions 完走後、`https://nobbytasso.github.io/ev-valuation-simulator/` にアクセスし、以下を確認してください。

- [ ] 一覧表示(シナリオ一覧が表示され、ヘッダーにダミーデータバッジが出ている)
- [ ] シナリオ作成→保存→リロードで復元される(セクターを選び「新規作成」→詳細表示→リロードしても内容が残る)
- [ ] 両テーマ切替(ヘッダーのテーマ切替ボタンでダーク⇄ライトが正しく切り替わり、レイアウト崩れがない)
- [ ] Excelダウンロード(シナリオ詳細のエクスポートボタンからxlsxファイルがダウンロードできる)
- [ ] フォント読込(Google Fonts CDNのInter/JetBrains Mono/M PLUS Rounded 1cが適用されて見える。CDN不達でも文字化けせずフォールバック書体で判読できること)
- [ ] ブラウザの開発者ツールのコンソールにエラーが出ていないこと

上記すべてが確認できれば、Phase 7(GitHub Pagesデプロイ)は完了です。

---

## 判断に迷った点

なし。spec §1.1・§1.2 の記述に忠実に実装し、判断事項(R7-1〜R7-6)はすべてspecの推奨案どおり採用済みのため、実装時の追加判断は発生しなかった。GitHub Actionsの各アクションバージョン(`checkout@v4` / `setup-node@v4` / `configure-pages@v5` / `upload-pages-artifact@v3` / `deploy-pages@v4`)は現行の安定メジャーバージョンを採用した。
