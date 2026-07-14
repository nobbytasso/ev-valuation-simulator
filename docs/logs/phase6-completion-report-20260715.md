# Phase 6 実装 完了報告

日付: 2026-07-15
指示元: `docs/phase6-spec.md` §11(Sonnet実装セッションへの指示書)、裁定: `docs/logs/phase6-rulings-20260714.md`(P6-1〜P6-9、P6-3のみ代替案採用・他は推奨案)
対象: デュアルテーマ磨き込み・金額単位切替・表示改善バッチ・判定色システム・円形ゲージ・theme-effects・WCAG AA。C1〜C12の全コミット完了。

---

## コミット一覧(§9 C1〜C12)

| # | コミット | 内容 |
| --- | --- | --- |
| C1 | `feat(ui): 金額フォーマッタ統一と単位切替` | `formatMoney`6重複を`src/ui/format/`に一本化、百万円/億円トグル(P6-1: 表示系のみ、入力・Excel固定) |
| C2 | `feat(theme): トークン第2層とCSS棚卸し` | 背景パターン・パネル罫・コーナーマーカー等の第2層トークン、共通`.panel`クラス。ハードコード色ゼロを確認 |
| C3 | `feat(theme): Webフォント導入` | Google Fonts CDN(P6-3裁定、preconnect+css2 display=swap)、CDN不達時フォールバックをE2Eで確認 |
| C4 | `feat(ui): keyMetrics統一表示と表記統一` | `KeyMetricsList`共通コンポーネント(B-2)、MOIC/IRRの「—(理由)」表記統一 |
| C5 | `feat(ui): ベンチマーク表示改善` | 出典行にbasis・notes(D-13)、years/countサフィックス(D-14) |
| C6 | `feat(ui): 判定色システム` | 25 metricの極性表(P6-5裁定)、`benchmarkStatus`判定関数、EV≤0警告(新規) |
| C7 | `feat(ui): 年次CFチャート` | SaaS・医療機器・クライメートの3セクター(D-16消化、P6-7裁定) |
| C8 | `feat(ui): 円形ゲージ` | `CircularGauge`、4箇所適用(P6-4裁定)、`useCountUp` |
| C9 | `feat(theme-effects): ダーク演出` | スキャン走査(P6-8裁定)・見出しデコード演出・ゲージ確定発光・日英キャプション(P6-6裁定) |
| C10 | `feat(theme-effects): ライト演出` | ハート/スパークル(`useParticleBurst`)、ボタンぷにスケール |
| C11 | `test(theme): AAコントラスト+テーマE2E総仕上げ` | `contrast.test.ts`(§8.1機械化)、ライト5トークンの色調整、E2E追加 |
| C12 | 本報告+デザインレビュー資料 | `docs/logs/phase6-design-review-20260715.md`(SS12枚+チェックリスト) |

エンジン・store・golden は無変更(全コミットがUI/テーマ層。方針どおり)。

---

## テスト結果

- `npm run typecheck` / `npm run lint` / `npm run test`: **全コミットで都度Green確認**(最終状態: vitest **472件** Green、oxlintは既存由来の警告4件のみでexit code 0)。
- `npm run test:e2e`: 既存11本(phase4/5-smoke)+Phase 6追加18本(phase6-smoke)の**計29本Green**。
- golden fixture(`src/engine/__fixtures__/*.golden.json`): **差分なし**(エンジンコード無変更のため)。

### oxlint警告について(Phase 5から継続、対応不要)

`ScenarioComparePage.tsx`・`PortfolioPage.tsx`の非同期ベンチマーク取得`useEffect`で`react-hooks(exhaustive-deps)`警告が計4箇所。Phase 5時点から存在する既知の意図的パターン(配列→プリミティブ変換での依存安定化)であり、Phase 6での変更なし。

---

## 実装内容の要点

### T1: トークン体系の第2層拡張(C2)
- `--pattern-bg`・`--panel-border-style`・`--corner-marker-size/-color`・`--shadow-glow-strong`・`--surface-overlay`・`--caption-font/-color`・`--gauge-*`・`--motion-duration-slow`・`--focus-ring`を両テーマに追加。
- 既存コンポーネントCSSにハードコード色(`#`/`rgba(`直書き)はゼロだったことを確認(棚卸し完了)。
- `.panel`共通クラスを新設し、`.sector-scenario-view > section`セレクタで各セクター結果ビューの全セクションに一括適用(個別CSSの重複を排除)。
- ライトの`--panel-border-style`を`1px solid transparent`にすることで、ダークの実線罫との太さ差によるレイアウトシフトを解消(E2E C2-1で検出・修正)。

### T2: Webフォント導入(C3)
- P6-3裁定によりGoogle Fonts CDN採用。npm依存追加なし、CDN不達時もトークンのフォールバックチェーンで判読維持(E2E C3-1)。
- 見出しの`line-height`を明示値(1.3)に固定。フォールバック書体(Hiragino Sans/Hiragino Maru Gothic ProN)間の内部メトリクス差によるレイアウトシフト誤検知を解消。

### T3: 金額表示単位切替(C1)
- `src/ui/format/`(money.ts・MoneyUnitProvider・useMoneyUnit)に一本化。億円は小数1桁(P6-2)。
- 適用範囲はP6-1裁定どおり表示系のみ。入力フォーム・Excel出力は百万円固定を維持(E2E C1-3, C1-2で確認)。

### T4: 円形ゲージ(C8)
- P6-4裁定の4箇所(EVベース・Rule of 40・VC法含意IRR・期待IRR/MOIC)に限定適用。
- ratio正規化定数(80/1.0/10)は根拠コメント付きで`gaugeConstants.ts`に集約。判定色はゲージ自身が発明せず、既存フラグ(VC法成立不可・EV≤0)のみ受け取る。
- `useCountUp`(framer-motion、初回のみ、reduced-motion尊重)。

### T5: 判定色システム(C6)
- `BenchmarkMetricConfig.direction`にP6-5裁定の全25 metric確定表を反映。`benchmarkStatus`(業界標準比±10%はcaution)。
- EV≤0警告を新規実装(spec想定の「既存警告」は実際には未実装だったため。詳細は`docs/logs/phase6-design-review-20260715.md` §3-1)。
- 資本政策・ポートフォリオ・比較ビューの「—(理由)」をcaution色に統一。

### T6: theme-effects(C9, C10)
- ダーク: スキャン走査(トリガーはプリセット適用時+シナリオ切替時のみ、P6-8裁定)、見出しデコード演出、ゲージ確定発光。すべて`:root[data-theme='dark']`スコープでコンポーネントにテーマ分岐を書かない設計原則3を遵守。
- ライト: ハート/スパークル(`useParticleBurst`、8〜12粒・600ms)、ボタンぷにスケール(`--button-active-scale`トークン)。
- 日英併記キャプション(`SectionHeading`+`sectionCaptions.ts`)を両テーマDOM常設(P6-6裁定)。既存E2Eの「結果」見出し完全一致アサーションをlevel指定に修正(キャプション追加によるアクセシブルネーム変化への対応)。

### T7: 表示改善バッチ(C4, C5, C7)
- keyMetrics統一表示(`KeyMetricsList`)でメディアの`paybackMonths`等、従来非表示だったキーを解消。
- ベンチマーク出典にbasis・notes(details開閉)・基準日(as_of)を追加。years/countの単位サフィックス。
- 年次CFチャート(D-16消化)をSaaS・医療機器・クライメートに追加。

### T8: 品質ゲート(C11)
- `contrast.ts`/`tokenParser.ts`でトークンCSSから相対輝度→コントラスト比を機械計算。両テーマ16ペアを4.5:1(大きな数値表示3:1)で固定。
- ライトの5トークン(text-muted・accent-contrast・warning・status-good/caution/bad)をテストGreen内で色調整。パステルの人格は維持。

---

## デザインレビュー資料(C12)

`docs/logs/phase6-design-review-20260715.md`に、代表6画面×両テーマ=12枚のスクリーンショット一覧・確認観点チェックリスト・実装中の判断メモを記載した(P6-9裁定どおり)。スクリーンショット本体はリポジトリにコミットせずスクラッチ領域に保存(Phase 4の先例を踏襲)。

撮影過程で判明した**スクリーンショットツール側の落とし穴**(Playwrightの`fullPage: true`がRechartsのResizeObserverを再発火させ、アニメーション未収束フレームを撮ってしまう。製品側のバグではない)をレビュー資料に記録した。

---

## 未確定事項・実装判断メモ

金額計算ロジックに関わるものはない(すべてUI表示・演出上の判断)。詳細と理由は`docs/logs/phase6-design-review-20260715.md` §3に記載。要点:

1. EV≤0警告の新規実装(spec想定の「既存警告」は未実装だったため)。
2. 円形ゲージのstatus未規定箇所(Rule of 40・期待IRR/MOIC)はneutral固定とし、新しい閾値を発明していない。
3. ライトの`--color-accent-contrast`を白から濃色シェードへ変更(AA未達のため、C11のコントラストテストGreen内での調整)。
4. 日英キャプションの適用範囲をP6-6裁定の7見出しに加え、対応するh2が存在しないページのh1にも適用。
5. 「基準日(as_of)/取得日」をエントリ単位の出典行に併記する形で実装。

---

## 完了条件の確認

- 全12コミット完了、各コミットで`npm run typecheck`/`lint`/`test`Green・golden差分なしを確認。
- 全コミットでE2E(`npm run test:e2e`)を11→29本まで維持・拡張してGreen確認。
- エンジン・store・golden は無変更(方針どおりUI/テーマ層のみ)。
- テーマ条件分岐(`if (theme === ...)`)はコンポーネントに書いていない(装飾はトークン2セット+`theme-effects/`隔離、設計原則3を機械的に確認可能な範囲でレビュー済み)。
- WCAG AAは`contrast.test.ts`で機械的に固定(要件§5制約1の機械化)。
- アニメーションは初回のみ・≤600ms・`prefers-reduced-motion`で無効化をE2Eで確認(C9-2, C10-3, C11-1)。
- IP上の注意(要件§5): キャラクター・ロゴ・固有名詞・フォントの複製はしていない(様式の参照のみ)。
- Excel・印刷系出力はプレーン表現のまま、単位切替の影響を受けない(E2E C1-2で確認)。
- デザインレビュー資料(SS12枚+チェックリスト)を`docs/logs/`に保存(P6-9)。

**Phase 6のクローズはユーザーによるデザインレビューOKをもって成立する**(P6-9)。本報告はその前提となる実装完了の一次確認であり、クローズの確定はユーザー確認後に別途記録する。
