# V2 本採用仕様書(v2-adoption-spec)v1.0 — 裁定反映 + 追加開発

日付: 2026-07-18 / ブランチ: `agent/investment-case-redesign`
前提: `docs/logs/v2-patch-acceptance-20260718.md`(条件付き受入)・`docs/redesign-v2.md`(V2設計)・CLAUDE.md
裁定(2026-07-18、ユーザー確定): ①engineへ移設 ②シナリオ要件をV2の仕組みに改訂 ③近似展開係数を既定採用+編集用テキストボックス追加 ④xlsxは`src/ui/excel/`へ移設 ⑤schemaVersion番号系は現状維持 ⑥削除された説明コメントを復元

追加開発(同日ユーザー指示): A)%入力の浮動小数点再燃修正 B)V2企業と旧ポートフォリオ管理の連動(最大) C)ケース別トップライン比較バーチャート+追加出資 D)投資家CF・リターンのバー/円チャート+クリックハイライトによるケース選択

**運用**: 詳細設計の判断(R-V2-1〜R-V2-5)は本書の推奨案を採用して実装まで進める(従来の事前授権パターン)。金額の意味に関わる R-V2-1(時価定義)・R-V2-3(円チャート構成)は完了報告で明示し、ユーザーが異議あれば fix する。

---

## 1. W1: 計算ロジックの engine 移設(裁定①)

- `src/engine/workbench/` を新設し、`src/v2/domain/valuation.ts` の全関数と `sectorDefinitions.ts` の各 `evaluate` 内の**計算部分**を純粋関数として移設する:
  - `projectMetric` / `presentValue`(既存 `npv.ts` と重複するため **`common/npv.ts` の `presentValue` を再利用**し、v2独自版は削除。t=1起点の違いに注意して吸収) / `terminalValue`(同様に既存を再利用。rate<=g で 0 を返すv2仕様は**呼び出し側でガード**し、エンジンは既存の EngineResult 版を使う) / `buildCaseResult`
  - セクター別 Exit 評価: `workbenchSaasExit(inputs)` 等6関数(引数はプレーンな数値パラメータ。ValueBag 依存を engine に持ち込まない — `numberValue`/`stringValue` での取り出しは UI 層に残す)
  - 追加出資の計算(§6 C)も engine に置く
- **UI 定義(FieldDefinition・ラベル・既定値・ケース名)は `src/v2/domain/sectorDefinitions.ts` に残し**、evaluate は engine 関数を呼ぶ薄い結線にする(ベンチマークマッピング表と同じ役割分担)。
- **Python リファレンス**: `tools/reference/workbench.py` に同モデルを独立実装し、`generate_fixtures.py` を拡張して `src/engine/__fixtures__/workbench.golden.json` を生成(乱数シード固定・境界値: 成長率0/負、targetMoic=1、yearsToExit=1、fullyDilutedShares=0、退出netDebtでequity≤0、追加出資0件/複数件)。TS 側 golden 突合テスト(相対誤差1e-9)。
- **プロパティテスト(fast-check)**: P18 成長率↑⇒ExitEV単調非減少 / P19 targetMoic↑⇒許容PostMoney単調減少 / P20 expectedMoic と expectedIrr の整合(moic^(1/y)-1) / P21 追加出資: 全トランシェ持分合計∈[0,1]かつ回収=exitEquity×exit持分。
- **engine-spec v0.8**: 新 §5「V2 Investment Case Workbench モデル」を追記(数式: projectMetric・Valuation Bridge・期待リターン順算・追加出資、§7の裁定記録参照)。golden 再生成は関連修正完了後に1回・単独コミット(既存規約)。
- 既存 v1 エンジン・golden は無変更。

## 2. W2: 要件改訂(裁定②)

- `docs/requirements-rev6.md` を新設(Rev.5 は履歴保持)。変更点: §4.1.1 シナリオ管理を V2 構造(1社=CompanyProfile+独立4ケース、/でWorkbench、/legacyは移行期間維持)に改訂、§3 のレンジ生成(悲観/ベース/楽観)記述を「V2は独立ケース方式(レガシー画面はレンジ方式を維持)」に更新、追加開発 B〜D を §4 に追加。他節は Rev.5 を踏襲。
- CLAUDE.md の「要件の正」参照を rev6 へ更新(1行)。

## 3. W3: 移行係数の編集可能化(裁定③)

- 近似展開係数(例: 成長率×[1.2, 1, 0.55, 0.15]、マルチプル pess×0.65 等)を**既定値として採用**し、`legacyMigration.ts` の係数をセクター毎の定数表 `MIGRATION_CASE_FACTORS` として抽出。
- インポートUIに「移行係数」折りたたみパネルを追加: 4ケース×主要係数のテキストボックス(既定=定数表)、「この係数で再展開」ボタンで旧JSONから再移行。係数は保存不要(移行時のみの一時値)。

## 4. W4〜W6(裁定④〜⑥)

- W4: `src/v2/ui/workbenchExcel.ts` → `src/ui/excel/buildWorkbenchWorkbook.ts` へ移設(xlsx import の隔離規約回復)。
- W5: schemaVersion 番号系は現状維持(対応不要。記録のみ)。
- W6: パッチが削除した説明コメントを復元(Header の D-5 根拠コメント、e2e/helpers.ts の共有・アクセシブルネーム注記)。

## 5. A: %入力の浮動小数点修正

- V2 の percent 変換は `InvestmentWorkbenchPage.tsx` の `toDisplay/fromDisplay`(×100 / ÷100)1箇所に集約されている。**表示側を Phase 6 の共通ヘルパー `ratioToPercentInput`(src/ui/format/percent.ts)経由に修正**(0.07→7、7.000000000000001を排除)。入力は%値(step=1 の整数中心、小数も許容)→内部 ÷100 の現行方針を維持(ユーザー指示と同方向)。
- 対象フィールド網羅の担保: `format: 'percent'` の全フィールドが同一関数を通ることをユニットテストで固定(ピーク売上想定の年次変化率・Exit時持分残存率・Exit時点の上市成功確率・売上価値の自社帰属率を含む代表ケース)。

## 6. B〜D: 追加機能の設計

### 6.1 B: 複数社対応とポートフォリオ連動(最大)

- **複数社**: `workbenchStorage` を「会社コレクション」に拡張: `ev-valuation-simulator:workbench:v2` に `{ activeCompanyId, workbenches: Record<companyId, WorkbenchState> }`。**後方互換ロード**: 旧単一 WorkbenchState を検出したら1社として包む(冪等・既存データ非破壊)。UIに会社切替セレクタ+「会社を追加/複製/削除」。
- **採用ケース**: `WorkbenchState` に `adoptedCaseId: string | null` を追加(§6.3 のクリック選択で設定。欠落時 null 補完)。
- **ポートフォリオ連動**: `PortfolioHolding` に `v2CompanyId?: string | null` を追加 → **PORTFOLIO_SCHEMA_VERSION v2→v3 マイグレーション必須**(null補完・冪等・v2 fixture回帰・両経路テスト。D-1 ルール)。
- ポートフォリオ画面の紐付けセレクトに「V2: 会社名」を旧シナリオと並んで選択可能に。
- **R-V2-1(時価定義・採用推奨)**: V2連動銘柄の時価 = **採用ケースの `currentAllowablePostMoney`(Valuation Bridge の現在許容Post-money)× holding.ownershipPct**。単一値(3点レンジなし。V2はケース=列で表現するため)。採用ケース未選択時はコスト評価にフォールバック(既存 P5-1 と同じバッジ)。
- ファンド集計・Excel は既存機構(portfolioAggregation)に V2 経路を追加。IRR は投資日(既存 investmentDate)→評価基準日で従来同様。

### 6.2 C: トップライン比較バーチャート + 追加出資

- **バーチャート**: ケース比較セクションに、4ケースの `exitMetric`(各セクターのトップライン: Exit ARR/売上/MAU由来売上等。創薬は Exit時ピーク売上価値)を単純バーチャートで表示(Recharts・トークン準拠・単位切替連動)。実装前に dataviz スキル(利用可能な場合)参照。
- **追加出資**: `InvestmentCase` に `followOns: { label: string; yearOffset: number; amount: number; postMoney: number }[]` を追加(欠落時 [] 補完・後方互換)。資本政策シミュレーターは使わない(ユーザー指示)。計算(engine):

```
初回: e_0 = investmentAmount / (proposedPreMoney + investmentAmount)
追加出資 i: e_i = amount_i / postMoney_i
Exit持分 = (Σ e_i) × dilutionRetention        ← 「EXIT時の希薄化率から逆算するのみ」
回収 = max(0, exitEquityValue) × Exit持分
MOIC = 回収 / Σ amount、IRR = irrBisection([(0, −初回), (yearOffset_i, −amount_i)…, (yearsToExit, +回収)])
```

- UI: ケースカード内に追加出資行(行キーは useStableListKeys)、各行に **Post-money入力+前回ラウンドPost-money比の倍率表示(例: ×1.8 / ×0.6、上げ下げの判定色)**。Σe_i > 1 は警告。
- **R-V2-2(採用推奨)**: 初回の「前回」は提示Post-money(proposedPreMoney+投資額)とする。

### 6.3 D: 投資家CF・リターンチャート + クリック選択

- **ケース選択**: ケース比較テーブルの列ヘッダ(またはケースカード)を**クリックでハイライト選択**(ドロップダウン禁止のユーザー指示)。選択状態は `adoptedCaseId` として保存し、B のポートフォリオ連動・D のチャートの両方が参照する。`aria-pressed` で選択を支援技術にも公開。
- **投資ケース画面**: 採用ケースについて (a) **投資/回収CFバーチャート**(x=年、負=初回+追加出資、正=Exit回収。判定色トークンで正負色分け) (b) **円チャート**: Exit回収額の構成 =「投下資本の回収分」+「超過リターン分」(回収<投資のときは「回収」+「元本毀損分」の構成で表示)【R-V2-3 採用推奨】。主要リターン値(MOIC/IRR/回収額)を隣接表示。
- **ポートフォリオ画面**: V2連動銘柄の採用ケースCFを年次合算した**ファンドCFバーチャート**+**時価構成の円チャート(銘柄別)**。V2未連動(旧シナリオ/コスト評価)銘柄は時価円チャートには含めるが、CFバーには投資日不明分を除外(注記)。
- チャートは `src/ui/` の共通コンポーネント化(v2専用にしない)。スタイリングはトークン準拠の素朴表現。

## 7. 実装計画(Sonnet 2バッチ+レビュー)

**Batch 1(裁定消化)**: C1 `refactor(engine)+feat(engine)`: workbench 計算の engine 移設+Python参照+golden+プロパティ(P18〜P20)+engine-spec §5 → C2 `docs`: requirements-rev6+CLAUDE.md 参照更新 → C3 `fix(ui)`: W3係数編集パネル+W4 xlsx移設+W6コメント復元+A %修正。
**Batch 2(追加機能)**: C4 `feat(store/ui)`: 複数社+adoptedCaseId+portfolio v3移行+連動時価 → C5 `feat(engine/ui)`: 追加出資(P21+golden追加ケース) → C6 `feat(ui)`: トップラインバーチャート → C7 `feat(ui)`: クリック選択+CF/円チャート(投資ケース+ポートフォリオ) → C8 `test(e2e)`: V2系E2E追加(選択→チャート反映・追加出資・ポートフォリオ連動・%表示) → C9 `docs`: 完了報告。
**共通完了条件**: typecheck / lint / vitest / test:e2e 全Green、v1 golden 差分なし(workbench.golden.json の新設・更新は単独コミット)、既存29 E2E 維持。

## 8. マージとデプロイ

全コミット完了+Fable レビュー承認後、`agent/investment-case-redesign` → main へマージし push(**本番 GitHub Pages に反映される**)。R-V2-1〜R-V2-3 の採用内容は完了報告で明示し、異議があれば fix で追随する。

*v1.0 — 2026-07-18(Fable)。裁定①〜⑥はユーザー確定、R-V2-1〜3 は推奨採用で進める。*
