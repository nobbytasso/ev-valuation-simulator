# Phase 4 実ブラウザ検証結果の査定と次アクション裁定案

日付: 2026-07-14
対象: `docs/logs/phase4-browser-verification-20260714.md`(§B・§C 全項目 PASS の報告)

## 1. 判定: 承認 — 製品コードの修正は不要、このまま進めてよい

検証レポートを精査した結果、判定は以下のとおり。

- **§C 全項目 PASS の報告は信頼できる**。検証方法が具体的(span 438→110百万円、期待IRR 86.1%/MOIC 11.99x、実メッセージ文言の一致確認など実値ベース)で、3件の見かけ上の失敗をスクリプト側の問題として切り分けた過程(span降順ソートによる行追跡ミス・HashRouter遷移がフルリロードを伴わない点・aria-labelによるアクセシブルネーム)もいずれも技術的に正確である。
- **Phase 4 の修正事項はゼロ**。修正方針は不要であり、Phase 4 はクローズとする。

## 2. ただし §4(コントラスト誤検知)の根本原因の記述を訂正する

レポート §4 は「ダークテーマの意図された演出(スキャン演出のテキスト漸次表示)が完了する前の撮影による見かけ上の現象」と推測しているが、**この原因の説明は誤り**である。コード照合の結果:

- テーマトークンは `:root[data-theme='dark']` / `:root[data-theme='light']` にスコープされている(`src/theme/tokens.*.css`)
- `data-theme` 属性は `ThemeProvider` の **useEffect(= React マウント後)** で初めて設定される(`src/theme/ThemeProvider.tsx`)
- `body` は `background-color` / `color` に 200ms の transition を持つ(`src/theme/base.css`)

つまり初回描画の瞬間は**テーマトークンが未定義**(`var(--color-bg)` 等が解決されない)で、マウント後に属性が付与されてから 200ms かけて最終色へ遷移する。観測された「読み込み直後だけ低コントラスト」はこの**初回描画のテーマ適用フラッシュ(FOUC)**であり、意図された演出ではない(スキャン演出等は Phase 6 で `theme-effects/` に実装予定であり、現時点では存在しない)。

**結論への影響はない**: 最終状態のコントラストが高く WCAG AA 違反ではないという判定、および「Phase 4 のスコープでは修正不要」はそのまま維持する。ただし FOUC 自体は毎回のページ読み込みで発生する軽微な表示欠陥であり、修正は `index.html` に「localStorage の保存テーマを読んで描画前に `data-theme` を付与する数行のインラインスクリプト」を置くだけで済む(慣用的な手法。テーマ条件分岐をコンポーネントに書かない原則にも抵触しない)。**次の Sonnet セッションでの修正を推奨する**(却下して Phase 6 のテーマ磨き込みに吸収する判断も可)。

## 3. 残タスクの整理と次アクション

| 項目 | 状態 | 推奨 |
| --- | --- | --- |
| Phase 4 機能・テスト・実ブラウザ検証 | 完了(全PASS) | クローズ |
| FOUC(初回描画のテーマ適用フラッシュ) | 新規発見(§2) | 小修正1コミットで解消(Sonnetプロンプトに含めた。不要なら削って使う) |
| §D E2Eテストの恒久化(@playwright/test) | 未実施(package.json 変更の事前了承待ち) | 実施推奨。下記プロンプトを渡すこと自体を了承とみなす(不要なら削って使う) |
| dilutionRetention ワンクリック反映 | バックログ登録済み(残存率定義の裁定とセット) | 据え置き |
| Phase 5(ポートフォリオ+Excel+並列比較) | 未着手 | **Phase 4 と同様に設計セッション(5-A)を先に行う**。下記プロンプトには含めない |

## 4. Sonnet への指示プロンプト(コピーして使用)

---

Phase 4 のクローズ作業を行います。実装済み機能の変更はありません。タスクは2件、いずれも独立した小タスクです。前提資料: `docs/logs/phase4-verification-assessment-20260714.md`(本指示の根拠)、`docs/logs/phase4-test-rerun-instructions-20260714.md` §D、CLAUDE.md。

### タスク1: fix(theme) — 初回描画のテーマ適用フラッシュ(FOUC)の解消

- 現象: テーマトークンが `:root[data-theme=...]` スコープなのに対し、`data-theme` 属性は `ThemeProvider` の useEffect で付与されるため、初回描画がトークン未定義で行われ、200ms の body transition を経て最終色になる。
- 修正: `index.html` の `<head>` に、localStorage(キーは `src/theme/themeContext.ts` の `THEME_STORAGE_KEY` と同値)から保存テーマを読み、`document.documentElement` に `data-theme` を描画前に設定するインラインスクリプトを追加する(未保存時は 'dark'。ThemeProvider 側の既定と一致させること)。ThemeProvider の既存ロジックは変更しない(useEffect の再設定は冪等なので害はない)。
- 完了条件: `npm run typecheck` / `lint` / `test` Green。実ブラウザ(`npx playwright screenshot` を読み込み直後 t=0 で撮影)で初回描画から高コントラストであること。ライトテーマ保存状態でのリロードも同様に確認。
- 制約: テーマ条件分岐をコンポーネントに書かない(CLAUDE.md 原則3)。キー文字列をリテラルで二重定義する場合は、themeContext 側の定数とズレないことをテストで固定すること。

### タスク2: test(e2e) — Playwright E2E テストの恒久化(§D)

- `npm i -D @playwright/test@1.61.1`(CLI とバージョンを揃える。Chromium は導入済みのため再ダウンロード不要)。package.json / ロックファイルの変更はこのタスクの了承範囲内。
- `playwright.config.ts`: `testDir: 'e2e'`、`use: { browserName: 'chromium' }`、`webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true }`。vitest(`npm run test`)と混ざらないこと(vitest の include に e2e/ が入らないことを確認)。scripts に `"test:e2e": "playwright test"` を追加。
- スペック(`e2e/phase4-smoke.spec.ts`)は最小セットとして: (1) シナリオ新規作成→感度分析セクション描画+`page.on('console')` でエラーゼロ (2) 資本政策のラウンド3行追加→中間行削除→後続行の値が行ズレしないこと (3) capitalPolicy の保存→リロード復元 (4) exitEvSource 切替で手取り額が変化 (5) タスク1完了後の t=0 スクリーンショットで body の computed color がトークン値と一致(FOUC回帰防止)。実装の参考: `docs/logs/phase4-browser-verification-20260714.md` §3 の3つの落とし穴(span降順ソート・HashRouter遷移はフルリロードなし・テーマトグルは aria-label)を必ず踏まえること。
- 完了条件: `npm run test:e2e` Green、既存 `npm run test`(vitest 323件)に影響なし。CI 組み込みは Phase 7(GitHub Pages デプロイ)で検討するため今回はスコープ外。

### 共通の注意

- コミットは2タスクで分ける(`fix(theme): ...` と `test(e2e): ...`)。エンジン・golden・既存UIコンポーネントの変更なし。
- Phase 5(ポートフォリオ・Excel・並列比較)には踏み込まない。
- 完了時、報告を `docs/logs/` に保存してコミットすること(CLAUDE.md)。

---

*本書の §2(FOUC の根本原因訂正)は、検証レポート §4 の記述に対する訂正として機能する。検証レポートの PASS 判定・結論自体は変更しない。*
