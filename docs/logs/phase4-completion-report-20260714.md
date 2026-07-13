# Phase 4 完了報告(感度分析トルネード + 資本政策シミュレーター)

日付: 2026-07-14 / セッション: Phase 4-B(実装、Sonnet)
対象: `docs/phase4-spec.md`(v1.1)§6 C1〜C9、裁定: `docs/logs/phase4-rulings-20260713.md`

---

## 1. 実施サマリ

phase4-spec.md §6 の C1〜C9 を指示どおり1コミット1機能で実装した。コミット一覧(`main` ブランチ):

| # | コミット | 内容 |
| --- | --- | --- |
| C1 | `test(engine): 創薬buildTornado統合テスト` | 監査ゲート条件3。δ=0で全ドライバーspan=0(P14)、既定入力+2品目(own・license混在)で列挙全ドライバーspan>0・件数=列挙数を検証。プロダクションコード変更なし |
| C2 | `feat(engine): 構造的span=0ドライバーの整理` | P4-1裁定(削除)。SaaS `discountRate`/`fcfMargin`、メディア `monthlyChurn`/`cpa`、EC/D2C `f2Rate`/`aov` を各 `SENSITIVITY_DRIVERS` から削除。engine-spec.md §1.5にU-21(確定)を追加。既存テストのδ=0.2検証をspan>0に強化 |
| C3 | `feat(ui): 感度分析レジストリ+ラベル` | `src/ui/sensitivity/sensitivityRegistry.ts`(SensitivityRegistry + buildTornadoRowsファサード)、6セクター分のdriverLabel表、`phaseLabels.ts` 抽出(DrugAssetFormとの重複解消) |
| C4 | `feat(ui): トルネードチャートセクション` | `SensitivitySection`(Recharts横棒、span降順上位10件+トグル、縮退span=0の「感度なし」グループ、ドライバー毎δ上書き、創薬discountRate.baseの固定±2pt表示、ドメイン外入力時のエラー表示)。SaaS/メディア/EC・D2Cにユニットエコノミクス注記(P4-1追加指示)。全6セクターに組み込み |
| C5 | `feat(engine): validateDilutionInputs` | DilutionInputsのドメイン検証を追加(P16/P17プロパティテスト)。engine-spec.md §1.4にU-22(確定、vcMethod.yearsToExit共用)を追加。`simulateDilution`シグネチャ不変 |
| C6 | `feat(store): Scenario v3(capitalPolicy)` | `SCENARIO_SCHEMA_VERSION=3`、`ScenarioCapitalPolicyInputs`追加、`migrateV2ToV3`+`defaultCapitalPolicyInputs`。新規fixture `legacy-scenario-v2.json` で単段移行、既存v1 fixtureで多段移行(v1→v2→v3)をテスト。冪等性・アダプタ両経路の回帰テストを更新(schemaVersion期待値2→3) |
| C7 | `feat(ui): useStableListKeys.reset` | 行配列の丸ごと差し替え直後に呼ぶ`reset(count)`を追加。既存2箇所のコンシューマー(DrugAssetForm/ClimateTechForm)は変更不要 |
| C8 | `feat(ui): 資本政策シミュレーターセクション` | `CapitalPolicySection`(初期保有者・将来ラウンド編集、持分推移マトリクス、Exit時自社実効持分・手取り、期待IRR/MOIC、exitEvSourceセレクト)。全6セクターに組み込み(VC法セクション直後)。scenarioId切替でreset発火 |
| C9 | 本コミット | 完了報告の保存、requirements-rev5.mdバックログ節へのP4-6登録 |

## 2. 裁定(P4-1〜P4-7)の反映状況

`docs/logs/phase4-rulings-20260713.md` の全7項目を反映済み。

| # | 裁定 | 反映箇所 |
| --- | --- | --- |
| P4-1 | 構造的span=0ドライバー6件を削除+UI注記 | C2(削除・engine-spec U-21)、C4(注記表示) |
| P4-2 | 変動幅設定は非永続(セッション内state) | C4(`SensitivitySection`のuseState、scenario.id切替でリセット) |
| P4-3 | 縮退span=0はラベル列挙(非表示にしない) | C4(「この変動幅では感度なし」グループ) |
| P4-4 | exitEvSource既定'base'、切替セレクト、EV≤0警告 | C6(型・デフォルト値)、C8(セレクトUI・警告表示) |
| P4-5 | Exit年はvcMethod.yearsToExitを共用 | C5(engine-spec U-22)、C8(接続実装) |
| P4-6 | Phase 4では非連動、参考値表示のみ+バックログ化 | C8(参考値は今回スコープ外につき未実装。バックログはC9で登録) |
| P4-7 | 保有者リスト編集(CapTableHolderと1:1) | C8(初期保有者テーブル: 名前/持分%/プール/自ファンド) |

**注記(未確定事項として報告)**: phase4-spec.md §4.3 は資本政策セクションに「初回出資時持分→Exit実効持分の残存率」の参考値表示を求めているが、残存率の定義(複数ラウンド出資時にどの出資分を基準にするか)がP4-6裁定でも未確定のまま据え置かれているため、C8では実装しなかった。バックログ登録(下記§4)により、残存率定義の裁定とセットで別途実施する。

## 3. 完了条件の充足状況

- `npm run typecheck` / `npm run lint` / `npm run test`: 全コミットで実行しGreen(最終状態: 30ファイル323テストGreen)
- golden fixture(`src/engine/__fixtures__/`): 全コミットで差分なし(Phase 4はgolden再生成を伴わない設計どおり)
- エンジンとUIの分離: エンジン変更はC2/C5のみ、対応するengine-spec更新を同一コミットに同梱。C1/C3/C4/C6/C7/C8はエンジン変更なし
- 既存テスト: 破壊なし。schemaVersion期待値の更新(2→3)はC6で意図的に実施
- `npm run build`(`tsc -b && vite build`): 成功

### UI動作確認について(限定事項)

CLAUDE.mdの方針に従い、UI機能はブラウザでの実動作確認を試みた。本セッションの実行環境には対話的ブラウザ自動化ツール(Playwright/chromium-cli等)が用意されておらず、`npx`経由の未認可外部パッケージ取得は許可設定上ブロックされたため、実ブラウザでのクリック操作・コンソールエラー確認は実施できなかった。代替として以下を実施している。

- `npm run dev` でのdevサーバー起動+疎通確認(HTTP 200)
- `npm run build` によるプロダクションビルド成功確認
- React Testing Library(jsdom)による実DOM描画+ユーザー操作シミュレーション(`SensitivitySection.test.tsx`、`CapitalPolicySection.test.tsx`、6セクター分のScenarioView.test.tsx)

実ブラウザでの見た目・操作感の最終確認はユーザー側で実施を推奨する。

**追記(2026-07-14、1回目)**: この限定事項の解消のため Playwright 1.61.1 + Chromium が導入された。再実行手順・実ブラウザ確認チェックリストは `docs/logs/phase4-test-rerun-instructions-20260714.md` を参照(自動テスト323件Greenの再確認とスクリーンショットスモークまで実施済み)。

**追記(2026-07-14、2回目)**: 上記手順書§B・§Cに従い、Playwright CLI(npxキャッシュ、依存追加なし)経由で実際にアプリを操作する検証スクリプトを実行し、感度分析・資本政策シミュレーターの全チェックリスト項目を実機能確認した。結果は `docs/logs/phase4-browser-verification-20260714.md` を参照。**この限定事項は解消済み。** なお1回目追記で記録された「ダークテーマの見出しコントラスト不足の疑い」は、再調査の結果、ページ読み込み時の意図されたテキスト漸次表示アニメーションを完了前に撮影したことによる見かけ上の現象であり、実際のコントラストはWCAG AAを大きく上回ることを確認した(誤検知、修正不要)。

## 4. requirements-rev5.md への反映

- §9 構築プロセス表: Phase 4 行に完了マーカーと本報告書への参照を追加
- バックログ節(§9末尾)に、P4-6裁定に基づく「資本政策シミュレーターから `vcMethod.dilutionRetention` へのワンクリック反映」を追加登録(残存率定義の裁定とセットで実施予定)

## 5. スコープ外(意図的に未実装)

phase4-spec.md §9「特に注意する点4」のとおり、以下はPhase 4のスコープ外として着手していない。

- 並列比較ビュー・ポートフォリオ機能(Phase 5)
- 判定色・円形ゲージ・単位切替等のビジュアル磨き込み(Phase 6)
- 資本政策シミュレーターの見た目上の装飾(テーマトークン参照の素朴な構造に留めた)
