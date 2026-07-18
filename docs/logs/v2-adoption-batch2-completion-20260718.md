# V2本採用 Batch 2(追加機能)完了報告

日付: 2026-07-18 / ブランチ: `agent/investment-case-redesign`
対象: `docs/v2-adoption-spec.md` §7 Batch 2(C4〜C9)
前提: `docs/logs/v2-adoption-batch1-completion-20260718.md`(Batch 1、C1〜C3)完了済み

## コミット一覧

| コミット | 種別 | 内容 |
| --- | --- | --- |
| `1e3dbd3` | `feat(store/ui)` | C4: 複数社対応(workbenchStorageの会社コレクション化・後方互換ロード)+adoptedCaseId追加+PORTFOLIO_SCHEMA_VERSION v2→v3(v2CompanyId)+ポートフォリオV2連動(時価=採用ケースのcurrentAllowablePostMoney×ownershipPct) |
| `222f4fc` | `feat(engine)` | C5(engine部): `computeFollowOnReturn`(追加出資を含む投資家リターン)+Python参照+P21+engine-spec v0.9 §5.5 |
| `1444a2b` | `feat(engine)` | C5(golden、単独コミット): workbench.golden.jsonに追加出資ケース3件(0/1/複数件)を追加 |
| `b5aeff0` | `feat(ui)` | C5(UI部): InvestmentCase.followOns追加+ケースカードに追加出資行(前回Post-money比の倍率表示・判定色) |
| `23f876f` | `feat(ui)` | C6: ケース比較トップラインバーチャート(CategoryBarChart新設) |
| `e856430` | `feat(engine)` | C7(engine部): `WorkbenchFollowOnResult.cashflows`公開+`composeFollowOnProceeds`(回収額構成の派生ヘルパー、R-V2-3) |
| `9c2d80c` | `feat(ui)` | C7(UI部): 列ヘッダのクリック選択(aria-pressed)+投資家CF/円チャート(投資ケース画面)+ファンドCF/時価構成チャート(ポートフォリオ画面)。チャート系列色トークン(`--color-chart-1〜6`)を追加 |
| `6037d38` | `test(e2e)` | C8: V2系E2E 4本追加(既存33本維持、計37本Green) |

（本ファイルが C9。)

## テスト結果(全コミット後の最終状態)

- `npm run typecheck`: Green
- `npm run lint`(oxlint): Green(`PortfolioPage.tsx`/`ScenarioComparePage.tsx`の react-hooks 警告2件は
  Batch 1 以前からの既存警告で対象外。新規警告なし)
- `npm run test`(vitest): **597 tests / 62 files 全Green**(Batch 1終了時544 → 最終597。
  内訳: `followOn.ts`関連27件、`workbenchStorage.test.ts`(会社コレクション)11件、
  `v2Linking.test.ts`9件、`CategoryBarChart`/`CompositionPieChart`各2件、
  `portfolioMigration`/`portfolioAggregation`のV2連動追加分、他)
- `npm run test:e2e`(Playwright、サンドボックス無効で実行): **37 tests 全Green**
  (既存33件 + `e2e/v2-workbench-batch2.spec.ts` 4件を維持)
- v1 golden(6セクター): `git diff main -- src/engine/__fixtures__/{climate_tech,drug_discovery,ec_d2c,media_tech,medical_device,saas_jp}.golden.json src/engine/sectors src/engine/common` は無出力(**差分なし**)
- `workbench.golden.json`: 追加出資ケース3件(`followon-zero-tranches`/`followon-single-tranche`/
  `followon-multiple-tranches`)を単独コミット(`1444a2b`)で追加。既存37ケースは無変更

## R-V2-1〜R-V2-3の採用内容(完了報告での明示、spec §0運用に基づく)

1. **R-V2-1(時価定義)**: V2連動銘柄の時価 = 採用ケースの `currentAllowablePostMoney × holding.ownershipPct`
   (単一値。3点レンジなし)。採用ケース未選択・会社削除済みは既存P5-1と同じコスト評価バッジへ
   フォールバック。`src/ui/portfolio/v2Linking.ts` の `resolveV2CompanyValuation` / `evaluateHolding`
   (`src/ui/portfolio/portfolioAggregation.ts`)に実装、E2E B2-3で回帰確認。
2. **R-V2-2(追加出資の「前回Post-money」)**: 1件目の追加出資の「前回」は初回投資の理論上の
   Post-money(Valuation Bridgeの`currentAllowablePostMoney`)ではなく、提示条件
   (`proposedPreMoney + investmentAmount`)を採用。§5.3の期待リターン順算と同じ基準に統一する
   判断。`src/engine/workbench/followOn.ts`、engine-spec.md §5.5に明記、E2E B2-2で回帰確認。
3. **R-V2-3(円チャートの構成)**: 回収額 ≥ 投資額のとき「投下資本の回収分」+「超過リターン分」、
   回収額 < 投資額のとき「回収」+「元本毀損分」の2分割。`composeFollowOnProceeds`
   (`src/engine/workbench/followOn.ts`)に実装。回収=投資額ちょうどのときは「投下資本の回収分」
   のみ(超過リターン分0)として`return`側に分類する仕様とした(境界値の判断、テストで固定)。

いずれも異議があれば fix で追随する前提(spec §0)。

## 判断に迷った点・仕様外の判断(仕様書へ反映済み)

1. **会社複製時のadoptedCaseId**: `duplicateCompanyInCollection`はケースIDを再採番するため、
   複製直後は`adoptedCaseId`をnullにリセットする(旧IDを指したままにしない)。
   `src/v2/store/workbenchStorage.ts`にコメントで明記。
2. **JSONインポート/再展開/セクター変更/リセットの会社スロット扱い**: 複数社対応後、これらの
   操作は「新しい会社を増殖させる」のではなく「現在アクティブな会社のスロット(会社id)を
   そのまま差し替える」設計にした(`preserveCompanyId`ヘルパー)。単一会社時代の挙動
   (アクティブな1社を丸ごと差し替える)に最も近い解釈で、コレクションに空スロットが
   残留する事故を避けるための判断。
3. **ファンドCFバーチャートの年次集計基準**: 「V2連動銘柄の採用ケースCFを年次合算」を、
   各銘柄の投資からの相対年(t=0が各社固有の初回投資年)で合算する設計とした
   (calendar年に正規化しない)。ポートフォリオの既存IRR計算(`computeYearsElapsed`)は
   投資日起点の実数年を使うが、V2ケースのCFは元々「投資からの相対年」のモデルのため、
   同じ基準で揃えるのが自然と判断。異なる投資時期の銘柄を横並びで年次合算する点は
   仕様上「年次合算」としか記述がないため、この解釈をengine-spec.md/UIコメントに明記した。
4. **`WorkbenchFollowOnResult.cashflows`と`composeFollowOnProceeds`のgolden対象外化**: 前者は
   IRR算出に使った既存CF列の再公開(新しい計算式ではない)、後者は既存2値(proceeds/
   totalInvested)の表示専用分解のため、Python参照実装・golden突合の対象に含めず、
   TSユニットテストのみで検証する方針とした。engine-spec.md §5.5に理由を明記。
5. **チャート系列色トークン**: 本デザインシステムには識別用(カテゴリ別)の複数系列トークンが
   存在しなかった(既存は accent/warning/status-good/status-caution/status-badのみ、かつ
   ダークモードでは`--color-accent`と`--color-status-good`が同一色)。第3層トークンとして
   `--color-chart-1〜6`を新設し、dataviz skillの検証済み既定パレット(references/palette.md)の
   hue順(blue/aqua/yellow/green/violet/red)をそのまま採用した(固定順・循環禁止の方針を維持)。
   回収額構成の円チャートでは、ダークモードのaccent=status-good問題を避けるため
   「超過リターン分」に`--color-chart-2`(アクア系)を割り当てた(実ブラウザ確認で
   accent/status-good混同による視認性劣化を検出し修正)。

## 禁止事項の遵守確認

- v1エンジン(`src/engine/sectors`, `src/engine/common`)・6セクターgolden: 無変更(git diff確認済み)
- v2エンジン移設部(Batch 1、`src/engine/workbench/valuation.ts`・`sectors.ts`・既存golden37ケース):
  無変更(追加出資ケース3件のみを golden へ追記)
- golden再生成は単独コミット(`1444a2b`)、engine/UIコミット分離を各Batchで実施
- `git push` は未実行
- 実ブラウザ(Playwright Chromium、開発サーバ)での目視確認を実施
  (会社切替UI・追加出資行・トップラインバーチャート・ケース選択+CF/円チャート・
  ポートフォリオのファンドCF/時価構成チャート)。ダークモードのaccent/status-good色衝突を
  この確認で発見・修正した
