# Phase 4 クローズ作業 完了報告

日付: 2026-07-14
指示元: `docs/logs/phase4-verification-assessment-20260714.md` §4 のSonnetプロンプト
対象: タスク1(FOUC解消)・タスク2(Playwright E2E恒常化)。実装済み機能(C1〜C9)の変更はなし。

---

## タスク1: fix(theme) — 初回描画のテーマ適用フラッシュ(FOUC)の解消

コミット: `90565de`

- `index.html` の `<head>` に `id="theme-fouc-guard"` のインラインスクリプトを追加。localStorage(キー `ev-valuation-simulator:theme`、`src/theme/themeContext.ts` の `THEME_STORAGE_KEY` と同値)から保存テーマを読み、`document.documentElement` に `data-theme` を描画前に設定する。未保存・不正値時は `ThemeProvider.readStoredTheme` と同じ既定 `dark` にフォールバック。
- `ThemeProvider` 自体は無変更(useEffectでの再設定は冪等)。
- キー文字列のリテラル二重定義がズレないことを `src/theme/indexHtmlThemeGuard.test.ts` で固定(5テスト: キー文字列一致・light/dark/未保存/不正値の各フォールバック)。

### 完了条件の確認

- `npm run typecheck` / `lint` / `test`: Green(328テスト、テーマガード5件を含む)
- 実ブラウザ確認: **プロダクションビルド(`vite build` + `vite preview`)** で、リロード直後(t=0)に `data-theme` 属性・CSSカスタムプロパティ・`body` の実描画色のすべてが最終値と一致することを確認(dark/light/reduced-motioneach 全パターン)。screenshot でも初回フレームから高コントラストであることを目視確認(スクラッチ領域に保存、リポジトリには含めず)。

### 開発サーバー(`npm run dev`)における既知の残存事項(対応不要と判断)

`npm run dev` はViteがCSSをJSモジュール経由で遅延注入する(HMR用の仕組み)ため、`data-theme` 属性とCSSカスタムプロパティ自体はt=0で正しく確定するものの、`body` の実描画色(`background-color`/`color`)がCSS注入完了までの数十ms反映されないケースがある。これは本修正(属性の先付け)とは無関係な、Vite開発サーバー固有のCSS配信タイミングの特性であり、実際の配信形態であるプロダクションビルドでは発生しない。E2Eスモーク(タスク2、テスト8)はこの点を踏まえ、遅延の影響を受けない `data-theme` 属性とCSSカスタムプロパティの値を検証対象とした(§タスク2参照)。

---

## タスク2: test(e2e) — Playwright E2Eテストの恒常化(§D)

コミット: `18aec2b`

- `@playwright/test@1.61.1` をdevDependencyに追加(ユーザー事前了承済み、査定文書§4に明記)。導入済みのChromiumを再利用、追加ダウンロードなし。
- `playwright.config.ts`: `testDir: 'e2e'`、`browserName: 'chromium'`、`webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true }`。
- `vite.config.ts` の `test.exclude` に `e2e/**` を追加(vitestのdefaultExcludeを維持しつつ拡張)。vitestとPlaywright Testの対象が混ざらないことを確認。
- `tsconfig.e2e.json`(DOM lib込み)を新設し `tsconfig.json` から参照。`e2e/` 配下もtypecheck対象に含めた。
- `package.json` に `"test:e2e": "playwright test"` を追加。
- `e2e/phase4-smoke.spec.ts` に8本のスモークを実装(査定文書§4の番号と対応、`phase4-browser-verification-20260714.md` §3の3つの落とし穴を踏まえた実装):
  1. シナリオ新規作成→感度分析セクション描画+コンソールエラーゼロ
  2. トルネードのドライバー毎δ変更で再計算される(行はラベルで追跡)
  3. 資本政策: ラウンド3行追加→中間行削除→後続行の行ズレなし
  4. capitalPolicyの保存→リロード復元
  5. exitEvSource切替で手取り額が変化
  6. v1形式データの移行(localStorage直接注入+明示リロード)
  7. JSONエクスポート→インポートの往復
  8. テーマ切替(aria-label照会)+FOUC回帰防止(通常/reduced-motion両エミュレーションでdata-theme・トークン値がt=0で確定)

### 実装中に見つけた調整点

- `getByRole('heading', { name: '結果' })` が `<h2>結果</h2>` と `<h3>シミュレーション結果</h3>`(資本政策セクション)の両方に部分一致し、strict modeで例外になった。`exact: true` を指定して解消。
- テスト8のFOUC検証は、当初 `body` の `background-color`/`color`(computed style)を直接比較する設計だったが、開発サーバー特有のCSS遅延注入(前述)により flaky になるため、`data-theme` 属性と `--color-bg`/`--color-text` のCSSカスタムプロパティ値を検証する設計に変更した。これは本修正の対象(属性の先付けスクリプト)をより直接的に検証する設計でもある。

### 完了条件の確認

- `npm run test:e2e`: **8/8 Green**(2回連続実行で再現性を確認)
- `npm run test`(vitest): 328件Green、変化なし(e2e/はvitestの対象から除外済み)
- `npm run typecheck` / `npm run lint`: Green
- `playwright-report/`・`test-results/` を `.gitignore` に追加(生成物はコミットしない)

### CI組み込みについて

査定文書の指示どおり、Phase 7(GitHub Pagesデプロイワークフロー設計)まではスコープ外とし、今回は実施していない。

---

## 共通の完了条件

- コミットは2件に分割(`fix(theme): ...` / `test(e2e): ...`)。エンジン・golden・既存UIコンポーネントの変更なし。
- Phase 5(ポートフォリオ・Excel・並列比較)には着手していない。
