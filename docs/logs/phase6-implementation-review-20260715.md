# Phase 6-B 実装レビュー報告書

日付: 2026-07-15 / レビュー範囲: `e61c0dd..67c08e7`(C1〜C12、12コミット)
方法: 読み取り・分析・機械的検証(テスト実行・grep照合・旧コミットとの突合)のみ。コード修正なし。
判定基準: `docs/phase6-spec.md` v1.1・裁定 `docs/logs/phase6-rulings-20260714.md`・CLAUDE.md 設計原則。
前提資料: `docs/logs/phase6-completion-report-20260715.md`(完了報告)・`docs/logs/phase6-design-review-20260715.md`(レビュー資料)

## 判定: **承認(実装レビューPASS)** — 修正を要する指摘なし

C1〜C12 は設計仕様・全9裁定・設計原則に適合している。完了報告の主張(テスト件数・エンジン不変・原則遵守・判断メモ)を独立に再検証し、**すべて事実と一致**した。指摘は軽微1件(§4、対応不要)のみ。

**本レビューは実装・仕様適合の監査であり、Phase 6 の完了条件「両テーマのデザインレビュー」(見た目の質の判定)は代替しない。** クローズにはユーザーの実機レビューOKが引き続き必要(P6-9)。

---

## 1. 機械的検証(本レビューで再実行)

| 項目 | 結果 |
| --- | --- |
| `npm run typecheck` | Green |
| `npm run lint` | 警告4件のみ・exit 0(**Phase 5 から継続の既知パターン**。ScenarioComparePage/PortfolioPage の依存配列安定化。完了報告の申告と一致) |
| `npm run test` | **472件 Green**(50ファイル。申告と一致) |
| `npm run test:e2e` | **29本 Green**(既存11+Phase 6追加18。申告と一致) |
| エンジン・store・golden | `git diff e61c0dd..HEAD -- src/engine src/store data tools` = **空**(無変更の申告を機械的に確認) |

## 2. 裁定(P6-1〜P6-9)適合の消込マトリクス

| # | 裁定 | 検証内容 | 判定 |
| --- | --- | --- | --- |
| P6-1 | 単位切替は表示系のみ | `src/ui/format/money.ts` に一本化(旧 formatMoney 6重複は残存ゼロ)。**`src/ui/excel/` に money-unit 系の import ゼロ**(Excel非連動をコードで確認)+E2E C1-2/C1-3 | ✓ |
| P6-2 | 億円は小数1桁 | `formatMoneyValue`: oku_yen → min/maxFractionDigits=1 固定 | ✓ |
| P6-3 | Google Fonts CDN | index.html: preconnect×2+css2 API(3ファミリー×各400/700・`display=swap`)。npm依存追加なし。CDN不達フォールバックは E2E C3-1 | ✓ |
| P6-4 | ゲージ4種限定 | CircularGauge の消費側は EvRangeResult(EVベース)・SaasScenarioView(Rule of 40)・VcMethodSection(含意IRR)・CapitalPolicySection(期待IRR/MOIC)の**ちょうど4箇所**。正規化定数は gaugeConstants.ts に根拠コメント付き | ✓ |
| P6-5 | 極性表25件+±10%帯域 | 全マッピング表の (metricId, direction) を機械抽出し裁定表と突合 → **25指標すべて一致**(セクター間の重複3指標も方向が整合)。`statusColor.ts` の CAUTION_BAND_RATIO=0.1 に裁定参照コメント | ✓ |
| P6-6 | 日英キャプション両テーマ常設 | `sectionCaptions.ts`(一般的財務英語のみ、IP要素なし)+E2E C9-3(両テーマDOM常設) | ✓ |
| P6-7 | 年次CFチャート実装 | SaaS/医療機器/クライメートに追加。**非対象セクターに出ないことも E2E C7-2 で検証**(D-16消化) | ✓ |
| P6-8 | スキャンはプリセット適用+シナリオ切替のみ | `useScanReveal(scenario.id:presetApplyCount)` — 初回レンダー・キー入力では発火しない実装。E2E C9-1/C9-2 | ✓ |
| P6-9 | SS12枚+チェックリスト | `phase6-design-review-20260715.md` に12枚一覧+14観点チェックリスト+判断メモ | ✓ |

## 3. 設計原則・品質ゲートの検証

- **原則3(テーマ分岐禁止)**: `theme ===` の残存は `ThemeToggle.tsx` の1箇所のみ。これはトグルボタン自身のラベル(「ライトモードへ切替」)で**機能上必須の分岐**(装飾ではない)、かつ Phase 2 から既存。違反なしと判定。theme-effects は全て `:root[data-theme=...]` スコープで、フック(scanReveal/particles)はテーマ非依存のクラス付与のみ — 模範的な分離。
- **reduced-motion**: base.css の全体ガードに加え、JS発火系4箇所(scanReveal・particles・CircularGauge・useCountUp)すべてに matchMedia ガードあり。E2E C9-2/C10-3/C11-1 で検証。
- **WCAG AA の機械化**: `contrast.test.ts` が両テーマ×(text/bg・text-muted/bg・text/surface・accent-contrast/accent(3:1)・status3色/bg・caption/bg)を 4.5:1(大数値3:1)で固定。ライト5トークンの調整はテストGreen内で実施(申告どおり)。
- **ハードコード色の棚卸し**: 全コンポーネントCSS+theme-effects を grep した結果、色直書きは **darkEffects.css の1件のみ**(§4 指摘1)。
- **レイアウトシフト**: E2E C2-1(boundingBox比較)。パネル罫の透明ボーダー・line-height明示化という具体的対策も完了報告に記録されており妥当。
- **演出の節度**: スキャン600ms・パーティクル8〜12粒600ms・カウントアップ初回のみ — 要件§5制約2/3の範囲内。パーティクルのトリガー(保存成功+プリセット適用)は spec §6.2 どおり。

## 4. 指摘(軽微・対応不要)

1. **darkEffects.css:16 の `rgba(77, 216, 230, 0.28)`**: スキャン走査のグラデーションが `--color-accent`(#4dd8e6 = rgb(77,216,230))と同一RGBの直書き。theme-effects 内(隔離場所)かつダークスコープなので実害はないが、spec §1 の「意図的な例外はコメントで根拠を書く」が当該行には付いていない。アクセント色を将来変更した際に追随漏れし得る。**対応不要**(Phase 7 以前に触る機会があれば `color-mix(in srgb, var(--color-accent) 28%, transparent)` への置換か根拠コメント追加を推奨)。

## 5. 実装判断メモ5件の裏取り

レビュー資料 §3 の5件を独立検証した。特に重要な1件:

- **判断1(EV≤0警告の新規実装)**: 「spec想定の既存警告は実際には未実装だった」という主張を旧コミットで裏取り — `git show e61c0dd:src/ui/EvRangeResult.tsx` に警告・0以下・negative の記述は**ゼロ**であり、主張は正確。新実装は `role="alert"`+status-bad で §5.1 の規則(EV≤0=bad)に忠実、新しい閾値の発明なし。**妥当**。
- 判断2(ゲージstatus=neutral固定)・判断3(accent-contrast濃色化)・判断4(キャプションのh1適用)・判断5(as_of/取得日併記)も、いずれも裁定表の範囲内・AAテスト整合・レイアウトシフト非該当を確認。**全件妥当、追加裁定は不要**。

## 6. 残タスク

- **ユーザーの実機デザインレビュー**(Phase 6 クローズの成立条件)。スクリーンショット12枚はスクラッチ領域で揮発済みのため、実機確認はブラウザ操作で直接行うか、必要なら再撮影を依頼すること(レビュー資料 §0 の撮影注意=fullPage と ResizeObserver の落とし穴に留意)。
- レビューOK後: requirements-rev5.md §9 Phase 6 行への完了マーカー反映(Phase 5 と同じ運用)。

*本報告書は読み取り・分析・テスト実行のみで作成(製品コード・テスト・文書本体への変更なし)。*
