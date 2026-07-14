# Phase 5 設計書(phase5-spec)v1.0 — ポートフォリオ管理 + Excelエクスポート + シナリオ並列比較ビュー

日付: 2026-07-14 / セッション: Phase 5-A(設計のみ。コード変更なし)
正とする文書: `docs/requirements-rev5.md` §4.1.1(並列比較)・§4.1.3(仮想ポートフォリオ)・§4.1.4(Excelエクスポート)・§5 制約4(出力はプレーン表現)・§9(Phase 5 完了条件: 出力Excel検収)
前提: Phase 4 完全クローズ済み(`docs/logs/phase4-closeout-20260714.md`。vitest 328件+E2E 8本 Green を本設計セッション冒頭で再確認)

本書は Phase 5 実装(別セッション、Sonnet)の設計仕様である。§8 の未確定事項(P5-1〜P5-9)が裁定されるまで実装に着手しないこと。engine-spec.md への追記案は §7 に差分として記載し、本設計時点では本体を編集していない。

---

## 0. 現状の棚卸しと設計上の重要事実

### 0.1 既存資産(Phase 5 が乗る土台)

| 資産 | 状態 |
| --- | --- |
| `PortfolioHolding` 型・CRUD | Phase 2 骨格あり(`portfolioStore.ts`・`PortfolioPage.tsx`)。companyName / sector / investmentAmount / round / ownershipPct / **scenarioId?(型のみ、UI未接続)** |
| ポートフォリオのマイグレーション | パイプライン構造あり(`portfolioMigration.ts`、MIGRATIONS は空、PORTFOLIO_SCHEMA_VERSION = 1) |
| IRR / MOIC | エンジン実装済み(`irrBisection` / `irrClosedFormSingle` / `moic`)。**エンジン追加は原則不要**(§7 の注記1件を除く) |
| SheetJS(xlsx) | `package.json` の dependencies に導入済み・**未使用**(import 実績ゼロ) |
| セクター判別ディスパッチの前例 | `SectorView`(switch)と `SENSITIVITY_REGISTRY` + `buildTornadoRows` ファサード(相関ユニオンの隔離パターン確立済み) |
| E2E 基盤 | `e2e/phase4-smoke.spec.ts` + `npm run test:e2e`(Phase 5 の受入スモーク追加先) |

### 0.2 【重要】IRR 計算に必要な「投資日」が PortfolioHolding に存在しない

ファンド単位集計(要件 §4.1.3: IRR/MOIC/時価総額)のうち IRR はキャッシュフローの時点情報を要するが、現行 `PortfolioHolding` に投資時点フィールドがない(`createdAt` は登録日であり投資日ではない)。**型拡張 + PORTFOLIO_SCHEMA_VERSION v1→v2 マイグレーションが必須**(CLAUDE.md 設計原則6。マイグレーションなしの型拡張は禁止)。→ §3.2・§5

### 0.3 【重要】エンジンの Cashflow.t は「整数年」注記付き

投資日→評価日の期間は一般に小数年になるが、`Cashflow.t` の型は `YearIndex`(engine-spec §0.1「整数」)。実装(`presentValue` / `irrBisection`)は `Math.pow(1+r, t)` であり小数 t でも数学的に正しく動くため、**実装変更なしで engine-spec に「IRR/PV の t は非負の実数を許容する(年フラクション)」の定義域拡張を追記**して使う。→ §7.1(エンジンのコード変更はテスト1件の追加のみ)

### 0.4 セクターモデルの EV の意味論(時価評価との関係)

セクターモデルの EV は評価時点の企業価値(rNPV・NTMマルチプル等の現在評価)であり、VC法・資本政策では同じ値を「Exit時企業価値の見積もり」として接続してきた(規約)。ポートフォリオの**時価総額は「現在の評価額」**なので、モデル EV をそのまま(Exit割引なしで)使うのが一貫する。株式価値への変換(−netDebt)は現在ネットデットの入力が存在しないため行わない(→ P5-2)。

---

## 1. T1: セクター横断の評価ディスパッチとラベル基盤(Phase 5 の共通基盤)

並列比較(§2)・ポートフォリオ時価(§3)・Excel(§4)の3機能すべてが「任意の `Scenario` を評価し、結果と入力を日本語ラベルで表示する」能力を必要とする。最初のコミットでこれを基盤として整備する。

### 1.1 評価ファサード `evaluateScenario`

```ts
/** Scenario ユニオンをセクター毎の evaluate に振り分ける(SectorView / buildTornadoRows と同じ隔離パターン) */
function evaluateScenario(scenario: Scenario): EngineResult<SectorValuationResult>
```

- 配置: `src/ui/scenarioEvaluation/evaluateScenario.ts`(UI層。根拠は phase4-spec §1.2 と同一: SectorId は store 層の語彙であり、エンジンには置けない)。
- 既存6ビューの個別 `evaluateX` 呼び出しは**置き換えない**(挙動同一だが Phase 5 のスコープ外の変更になるため。置き換えは Phase 6 の整理に委ねる)。

### 1.2 ラベル表(Excel・比較表の表示語彙)

既存の駆動源: フォーム文言(Phase 4 の driverLabels で照合済みの語彙)・`SECTOR_LABELS`。新設するもの:

1. **keyMetrics ラベル表**: `Record<string, { label: string; format: 'pt' | 'x' | 'months' | 'years' | 'yen' | 'ratio' }>` をセクター毎に定義(対象キーは現状: SaaS `ruleOf40` / メディア `avgLifetimeMonths` `ltv` `ltvCpaRatio` `paybackMonths` / EC `contributionMarginRatio` `ltv` `ltvCacRatio`。医療機器・クライメート・創薬は現状空)。
2. **入力フィールドラベル表**: Excel「前提条件」シート用に、セクター毎の `inputs` 全フィールドの日本語ラベル+単位+フォーマッタを定義する(`src/ui/sectors/<sector>/<sector>FieldLabels.ts`、6ファイル)。文言は各 Form.tsx の実ラベルと一致させる(phase4-spec §2.2 と同じ規律。同じ概念に別の日本語を使わない)。
   - 配列フィールドの規約: 創薬 `assets[]` は「品目ブロック」(品目名見出し+品目内フィールド)、クライメート `capexSchedule[]` は「年・金額の2列表」、資本政策 `rounds[]` は「ラウンド表」として展開する(ラベル表に配列展開の種別を持たせる)。
   - `Ratio` は「%」表示(×100)、`Yen` は「円」、`Money` は「百万円」。列ヘッダに単位を明記する。

配置規約: セクター固有表は `src/ui/sectors/<sector>/`(BenchmarkMetrics・driverLabels と同居)、横断ファサードとフォーマッタは `src/ui/scenarioEvaluation/`。

---

## 2. T2: シナリオ並列比較ビュー(表+チャート)

### 2.1 画面と導線

- 新ルート `compare`(`/#/compare?ids=<id1>,<id2>,...`)。**選択状態は URL クエリで持つ**(HashRouter で動作可・リロード/共有耐性あり・型変更ゼロ)。
- `ScenarioListPage` に行チェックボックスと「選択したシナリオを比較(n件)」ボタンを追加。上限は P5-6(推奨4件)。上限超過はチェック不可+件数表示。
- 比較ビュー(`src/ui/compare/ScenarioComparePage.tsx`)は**読み取り専用**(編集は各シナリオ詳細で行う。draft 概念を持ち込まない)。ids のシナリオが見つからない場合は該当列を「見つかりません」表示(URLの手編集耐性)。

### 2.2 表の構造(セクター混在の扱い → P5-5)

推奨案(P5-5)は「混在許可+2層構造」:

1. **共通ブロック(常に表示)**: 行 = シナリオ名 / セクター / EV悲観 / EVベース / EV楽観 / VC法(目標倍率・含意IRR・投資額) / 期待IRR / 期待MOIC(資本政策から。ラウンド未登録は「—」)。列 = 選択シナリオ。
   - 期待IRR/MOIC は `simulateDilution`(exitEvSource は各シナリオの保存値)で算出。`validateDilutionInputs` が issue を返す場合・EV−netDebt ≤ 0 の場合は「—」+ツールチップ相当の注記(Phase 4 の CapitalPolicySection と同じガード)。
2. **セクター別ブロック(同一セクターが2件以上のときのみ表示)**: keyMetrics(§1.2 のラベル表)と主要ドライバー値を、そのセクターのシナリオ列だけで並べるサブテーブル。主要ドライバー = 各セクターの `SENSITIVITY_DRIVERS`(感度対象)を「比較で見るべき主要入力」として流用する(新しい選定基準を発明しない。創薬はパス形式のため §1.2 の品目ブロック表示を簡略化した「品目数・合計ピーク売上・割引率(ベース)」の3行に留める)。

### 2.3 チャート

- 1本のみ: **EVレンジのグループ棒チャート**(X=シナリオ、悲観/ベース/楽観の3系列。Recharts、テーマトークン参照の素朴な描画)。判定色・凝った演出は Phase 6。
- 数表とチャートは同じ計算結果(`evaluateScenario` の memo)を共有する(式の二重評価をしない)。

---

## 3. T3: 仮想ポートフォリオ管理の拡充(ファンド単位集計)

### 3.1 銘柄とシナリオの紐付け

- `PortfolioPage` の各行に「評価シナリオ」セレクトを追加(候補 = **同一セクターのシナリオのみ**。`holding.sector` と不一致の紐付けは UI で選択不可)。既存の `scenarioId?` フィールドをそのまま使う。
- 紐付いたシナリオが削除された場合: ロード時に解決できない `scenarioId` は「(削除済み)」表示とし、評価は未紐付け扱い(P5-1 の規則に従う)。参照整合はロード時チェックのみ(カスケード削除はしない)。

### 3.2 型拡張(v1→v2)— 投資日の追加

```ts
interface PortfolioHolding {
  ...既存フィールド
  investmentDate: string | null   // ISO8601日付。IRR計算の起点。v2で追加
}

const PORTFOLIO_SCHEMA_VERSION = 2
```

- **マイグレーション**: `MIGRATIONS[1] = migrateV1ToV2`(`investmentDate` 欠落時に **null を補完**。P5-3 推奨案: createdAt を投資日と偽装しない — 誤ったIRRを黙って出すより「未設定」を明示する)。冪等性・旧形式 fixture(v1)からの回帰テスト・エクスポート/インポート経路(アダプタ注入済み)のテストを同一コミットで実装する(D-1 ルール)。
- UI: 追加フォームと一覧行に投資日(date input)を追加。null は「未設定」。

### 3.3 銘柄単位の評価値

評価基準日 `T_eval` = 今日(UI層で `new Date()`。エンジンに日付を渡さない → P5-4)。

```
EV_k(holding)   = evaluateScenario(linkedScenario).ev[k]        (k ∈ {pessimistic, base, optimistic})
時価_k          = ownershipPct × EV_k                            (企業価値ベース → P5-2)
年数 t          = (T_eval − investmentDate) / 365.25             [小数年 ≥ 0。§7.1 の定義域拡張]
MOIC            = 時価_base / investmentAmount                    (未実現・グロス)
IRR             = irrBisection([ { t: 0, cf: −investmentAmount }, { t, cf: 時価_base } ])
                  ※ t = 0(当日投資)や investmentDate = null のとき IRR は「—」
```

- 未紐付け・評価不能(エンジン ok:false)・シナリオ削除済みの銘柄の時価は P5-1 の裁定に従う(推奨: 投資額で代替=コスト評価とし、行に「コスト評価」バッジを表示。ダミーデータバッジと同じ「値の素性を隠さない」原則)。
- IRR/MOIC の式は UI に複製せず、エンジンの `irrBisection` / `moic` を呼ぶ(CLAUDE.md エンジン変更規則)。CF列の構築(データ整形)は UI 層の純粋関数 `buildHoldingCashflows` としてテスト可能に切り出す。

### 3.4 ファンド単位集計(サマリ)

```
時価総額_k   = Σ 時価_k(holding)                     (k = 3点。コスト評価分を含む場合はその旨注記)
投資額合計   = Σ investmentAmount
ファンドMOIC = 時価総額_base / 投資額合計
ファンドIRR  = irrBisection(全銘柄のCF列を連結)       (投資日未設定の銘柄が1件でもあれば「—」+注記)
```

- サマリ表: 時価総額は悲観/ベース/楽観の3列、IRR/MOIC はベース基準のみ(P5-9 推奨。3点IRRは情報過多)。
- 表示上の区別(重要): ポートフォリオの IRR/MOIC は「**投資実績(投資日・投資額)と現在時価**に基づく未実現値」であり、シナリオ詳細の「期待IRR/MOIC」(資本政策シミュレーターの Exit 予測)とも「含意IRR」(VC法の目標逆算)とも異なる。3表示のキャプションを明確に書き分ける(Phase 4 §4.3 の整理を踏襲)。
- 集計ロジックは `src/ui/portfolio/portfolioAggregation.ts` の純粋関数群として実装し、単体テストする(コンポーネントから分離)。

---

## 4. T4: Excelエクスポート(SheetJS)

### 4.1 共通方針

- 実装は `src/ui/excel/` に隔離し、**`xlsx` の import はこのディレクトリに閉じる**(エンジン・store・他UIから直接依存しない。Stage 2 でのライブラリ差し替え耐性)。
- 生成はすべてブラウザ内(`XLSX.write` → Blob → ダウンロード)。**外部送信なし**(設計原則4)。ダウンロード処理は既存 `downloadJsonFile.ts` と同型の薄いラッパー `downloadXlsxFile.ts`。
- 装飾なしのプレーン表現(要件 §5 制約4)。値+ヘッダ行のみ、テーマ非依存。数値は数値型セルで出力(文字列化しない。検収でSUM等が効くこと)。%は小数(0.25)ではなく百分率数値(25)+ヘッダに「%」を明記。金額は百万円+ヘッダ明記(単位切替は Phase 6)。
- ファイル名: `{シナリオ名}.xlsx` / `シナリオ比較_{n}件.xlsx` / `ポートフォリオサマリ.xlsx`(日付は入れない。localStorage 由来で再現可能なため)。
- ワークブック構築関数は **Blob 化と分離した純粋関数**(`buildScenarioWorkbook(scenario): WorkBook` 等)とし、テストは `XLSX.read` で読み戻して値を検証する(jsdom で完結。ダウンロードのE2Eは §6 のスモークで1本)。

### 4.2 3種のワークブック構成

| 種別 | シート構成 |
| --- | --- |
| ①シナリオ単票 | 「結果」: EVレンジ(3点)・auxiliary(あれば)・keyMetrics(ラベル表)・VC法(入力+全出力レンジ表)・期待IRR/MOIC(資本政策。P5-8採用時は持分推移とラウンド表も)+感度分析上位10行(P5-8) /「前提条件」: §1.2 のフィールドラベル表による全入力(配列はブロック展開)・schemaVersion・エクスポート時点の注記(ダミーデータバッジ状態を含む) |
| ②比較表 | 「比較」: §2.2 の共通ブロック+セクター別ブロックと同一内容(行=指標、列=シナリオ) /「前提条件」: シナリオ毎に §1.2 展開を縦に連結(セクター見出し付き) |
| ③ポートフォリオサマリ | 「サマリ」: 銘柄一覧(企業名/セクター/投資日/投資額/持分/評価シナリオ名/時価3点/MOIC/IRR/評価方法=シナリオ or コスト)+ファンド合計行(§3.4) /「前提条件」: 評価基準日・各銘柄の紐付けシナリオ名と exitEvSource・コスト評価銘柄の一覧・ベンチマークが dummy の場合の注記 |

- 比較ビュー・ポートフォリオ画面・シナリオ詳細のそれぞれに「Excelエクスポート」ボタンを置く(画面の表示内容と出力内容を一致させる。検収を画面と突き合わせて行えるようにするため)。
- 「値の素性」の明示: Stage 1 はベンチマークがダミーであること(`data_status: "dummy"`)を前提条件シートに必ず記す(実データと混同させない原則のExcel版)。

---

## 5. T5: 型・マイグレーション変更の総括

| 対象 | 変更 | マイグレーション |
| --- | --- | --- |
| `PortfolioHolding` | `investmentDate: string \| null` 追加 | **v1→v2**(null補完・冪等・v1 fixture回帰・両経路テスト)。§3.2 |
| `Scenario` | **変更なし**(v3 のまま) | 不要(比較・Excelは読み取りのみ) |
| 比較ビューの選択状態 | URLクエリ(非永続) | 不要 |

`PORTFOLIO_STORAGE_KEY` は `...:portfolio:v1` のままとする(キー名の v1 はストレージ位置の識別子であり schemaVersion とは独立。キーを変えると旧データが孤児になるため変更しない)。

---

## 6. T6: テスト計画と実装順序(コミット分割)

1機能1コミット、エンジンとUIは別コミット。各コミット共通の完了条件: `npm run typecheck` / `lint` / `test` Green + golden 差分なし + 既存 E2E 8本 Green(UI変更コミットのみ)。

| # | コミット | 内容 | 固有の完了条件 |
| --- | --- | --- | --- |
| C1 | `docs(engine-spec): Cashflow.t の実数許容を明記` + `test(engine)` | §7.1 の定義域拡張追記+小数年 t の IRR/PV 回帰テスト各1件(実装変更なし) | golden 差分なし・エンジンコード無変更 |
| C2 | `feat(ui): 評価ファサードとラベル基盤` | `evaluateScenario`+keyMetricsラベル表+フィールドラベル表6ファイル。テスト: 6セクターの評価一致(既存evaluateXと同値)・ラベル表の網羅(inputsの全キーにラベルが付くことを型 or テストで担保) | — |
| C3 | `feat(ui): シナリオ並列比較ビュー` | ルート追加・一覧のチェックボックス・比較表(共通+セクター別ブロック)・EVレンジチャート。テスト: 混在時のブロック出し分け・上限・不明id耐性・期待IRR/MOICのガード | — |
| C4 | `feat(store): PortfolioHolding v2(investmentDate)` | 型+`migrateV1ToV2`+`legacy-holding-v1.json` fixture+冪等・両経路回帰テスト | 既存ポートフォリオテスト Green 維持 |
| C5 | `feat(ui): ポートフォリオのシナリオ紐付けと集計` | 紐付けセレクト・投資日入力・`buildHoldingCashflows`/`portfolioAggregation` 純粋関数+テスト(コスト評価分岐・null投資日・削除済みシナリオ・3点集計)・サマリ表示 | — |
| C6 | `feat(ui): Excelエクスポート基盤+シナリオ単票` | `src/ui/excel/`・`buildScenarioWorkbook`・ダウンロードラッパー。テスト: read-back で値・シート名・単位ヘッダ検証(6セクター+資本政策・感度含む) | — |
| C7 | `feat(ui): 比較表・ポートフォリオサマリのExcel` | `buildCompareWorkbook` / `buildPortfolioWorkbook` + read-back テスト(コスト評価注記・dummy注記含む) | — |
| C8 | `test(e2e): Phase 5 スモーク` | 追加3本: 比較ビュー表示(2シナリオ選択→表とチャート描画+consoleエラーゼロ)/ポートフォリオ紐付け→時価・IRR表示/Excelダウンロード(`page.waitForEvent('download')` でファイル生成を確認) | `npm run test:e2e` 全件 Green |
| C9 | `docs: Phase 5 完了報告` | docs/logs/ へ保存(受入=出力Excel検収の結果を含む) | — |

依存: C1→C5(小数年IRR)、C2→C3/C6/C7、C4→C5→C7。C1・C2・C4 は並行可能だが上表の順を推奨。
**Excel検収**(§9 完了条件)は C6/C7 後にユーザーが実ファイルを開いて行う。検収用の代表データ(6セクター各1+ポートフォリオ3銘柄)を E2E ではなく手順として完了報告に記載する。

---

## 7. engine-spec 追記案(C1 で本体に反映)

### 7.1 §1.3(IRR/MOIC)・§0.1 への追記

> **時点の定義域(Phase 5追記)**: `Cashflow.t` は年単位の**非負の実数**を許容する(年フラクション。例: 投資日から評価日までの 2.37 年)。§0.4 の二分法・`presentValue` は `Math.pow(1+r, t)` によりそのまま成立する。`YearIndex`(整数)はセクターモデルの年次CF・ラウンド年で従来どおり使用し、実数年はポートフォリオの未実現IRR等の呼び出し側でのみ用いる。実装変更なし(回帰テストのみ追加)。

### 7.2 §4 未確定事項表への追記

> | U-23 | ポートフォリオ時価の定義 | EV × 持分(企業価値ベース、netDebt控除なし。現在ネットデット入力は Stage 2 で再設計。P5-2裁定) | **確定** |
> | U-24 | 未紐付け・評価不能銘柄の評価 | 投資額で代替(コスト評価)+「コスト評価」バッジ表示(P5-1裁定) | **確定** |

(医療機器 implied マルチプルは P5-7 裁定により **Phase 5 に含めないことが確定**。バックログ節の記載どおり、Phase 5 完了後の独立バッチとしてエンジン・Python・golden・キー集合比較の4点セットを別途起こす。)

---

## 8. 未確定事項一覧(全9項目 裁定済み)

**2026-07-14 に全項目が裁定された**(原文: `docs/logs/phase5-rulings-20260714.md`)。**すべて下表の推奨案が採用**され、§9 の実装指示書に反映済み。下表は設計時の選択肢とトレードオフの記録として残す(金額の意味に関わるのは P5-1〜P5-4)。

| # | 論点 | 推奨 | 代替案 | トレードオフ |
| --- | --- | --- | --- | --- |
| **P5-1** | 未紐付け・評価不能・シナリオ削除済み銘柄の時価 | **投資額で代替(コスト評価)+行に「コスト評価」バッジ** | 集計から除外(時価総額の分母から消す) | コスト評価: VC実務(直近ラウンド原価法)に近く、時価総額が「全銘柄の合計」であり続ける。除外: 保守的だが時価総額が銘柄構成で不連続に変わり誤読しやすい |
| **P5-2** | 時価の定義 | **EV × 持分(企業価値ベース、netDebt控除なし)+表注記** | (EV − vcMethod.netDebtAtExit) × 持分 | EVベース: 現在ネットデット入力が存在しないため一貫・単純。控除案: 株式価値としては正しいが「Exit時」の netDebt を現在に流用する歪みが生じる(Stage 2 で現在BS入力を足すときに再設計) |
| **P5-3** | 既存データへの investmentDate 補完 | **null 補完(IRRは「—(投資日未設定)」)** | createdAt で補完 | null: 誤ったIRRを出さない・ユーザーに入力を促せる。createdAt: 全行でIRRが出るが登録日≠投資日の嘘の数字になる |
| **P5-4** | 評価基準日 | **今日(UI層で算出、画面とExcelに評価日を明記)** | 手入力の基準日フィールド | 今日: 入力レス・「現在の時価」の意味に合致。エンジンには数値のみ渡し純粋性維持。手入力: 過去時点の再現ができるが Stage 1 の用途では過剰 |
| **P5-5** | 並列比較のセクター混在 | **許可(共通ブロック+同一セクター2件以上でセクター別ブロック)** | 同一セクター限定 | 混在許可: 企業間比較ができ、共通指標(EV/IRR/MOIC)は常に比較可能。限定: 実装が簡単でドライバー行を常に並べられるが、ポートフォリオ横断の比較ができない |
| **P5-6** | 比較件数上限 | **4件**(表の可読性・チャート系列数) | 6件 / 無制限 | 4超は列幅が崩れ、Phase 6 での磨き込み対象が増えるだけ |
| **P5-7** | 医療機器 implied EV/売上マルチプル(バックログ「Phase 5前後」)の扱い | **Phase 5 に含めない**(完了後の独立バッチ。エンジン3点同期+golden再生成+キー集合比較を伴うため) | C1 の前に独立バッチとして先行実施 | 含めない: Phase 5 のgolden不変が保て、検収スコープが明確。先行: 医療機器の比較表・Excelにマルチプルが最初から載るが、Phase 5 全体が golden 再生成に依存する |
| **P5-8** | Excel単票に感度分析・資本政策をどこまで含めるか | **含める**(感度上位10行+ラウンド表+持分推移。単票=シナリオの全体像として自己完結) | EVレンジ+keyMetrics+VC法のみの最小構成 | 含める: 検収項目は増えるが「前提条件込みの1ファイル」という要件趣旨に合う。最小: 実装は軽いが結局 Phase 6 で追加することになる |
| **P5-9** | ファンド集計のレンジ表示 | **時価総額のみ3点、IRR/MOICはベース基準のみ** | IRR/MOICも3点 | 3点IRRは「悲観時価に対する未実現IRR」という解釈の難しい数字が並ぶ。必要になれば後付け可能 |

---

## 9. Sonnet 実装セッションへの指示書(ドラフト)

> Phase 5-B(実装)セッション冒頭に貼る指示書。裁定結果(2026-07-14確定、`docs/logs/phase5-rulings-20260714.md`)は反映済みであり、このまま使用できる。

---

Phase 5 の実装を行います。設計は `docs/phase5-spec.md` に確定済みです。**必ず全文を読み、下記の裁定結果に従って実装してください。**

### 裁定結果(P5-1〜P5-9、2026-07-14確定・全項目推奨案採用。原文: docs/logs/phase5-rulings-20260714.md)

- **P5-1**: 未紐付け・評価不能・シナリオ削除済み銘柄は投資額で代替(コスト評価)+「コスト評価」バッジ
- **P5-2**: 時価 = EV × 持分(企業価値ベース、netDebt控除なし)+表注記
- **P5-3**: 既存データの investmentDate は null 補完(IRRは「—(投資日未設定)」)
- **P5-4**: 評価基準日は今日(UI層で算出し画面・Excelに明記。エンジンには数値のみ渡す)
- **P5-5**: セクター混在許可(共通ブロック+同一セクター2件以上でセクター別ブロック)
- **P5-6**: 比較件数上限 4件
- **P5-7**: 医療機器 implied マルチプルは含めない(独立バッチのまま)
- **P5-8**: Excel単票に感度分析(上位10行)・資本政策(ラウンド表+持分推移)を含める
- **P5-9**: 時価総額のみ3点、IRR/MOICはベース基準のみ

### 実装順序とコミット

phase5-spec.md §6 の C1〜C9 の順に、1コミットずつ進めること。C1(engine-spec 追記+実数年テスト)が最初。

### 各コミット共通の完了条件(CLAUDE.md DoD)

- `npm run typecheck` / `npm run lint` / `npm run test` すべて Green、golden fixture 差分なし
- UI変更コミットでは `npm run test:e2e`(既存8本)も Green を維持
- エンジンとUIを同一コミットに混ぜない(C1 の engine-spec 追記+テストのみは例外)

### 特に注意する点

1. **マイグレーションなしの型拡張は禁止**: C4 は型追加・バージョン繰り上げ(PORTFOLIO_SCHEMA_VERSION=2)・migrateV1ToV2・v1 fixture 回帰・冪等性・両経路テストを同一コミットで完結。`PORTFOLIO_STORAGE_KEY` は変更しない。
2. **IRR/MOIC の式を UI に複製しない**: 必ず `irrBisection` / `moic` を呼ぶ。CF列構築は純粋関数に切り出してテスト。日付(`new Date()`)は UI 層に閉じ、エンジンには数値のみ渡す。
3. **xlsx の import は `src/ui/excel/` に閉じる**。ワークブック構築は純粋関数とし、`XLSX.read` での読み戻しテストを必須とする。数値セルは数値型で出力(検収条件)。
4. **ラベルの一貫性**: 表示・Excel の日本語ラベルは既存フォーム文言・SECTOR_LABELS・Phase 4 driverLabels と一致させる。新しい訳語を発明しない。
5. **値の素性の明示**: コスト評価バッジ、投資日未設定の「—」、ダミーベンチマーク注記(Excel前提条件シート)を省略しない。
6. **スコープ外**: 単位切替・判定色・円形ゲージ等(Phase 6)、GAS/Drive(Stage 2)、医療機器 implied マルチプル(P5-7 が「含めない」の場合)。dilutionRetention ワンクリック反映(バックログ)にも触れない。
7. 仕様にない判断は「未確定事項」として列挙し、仮の妥当値+TODOで進める。金額計算に関わるものは停止して確認。
8. 完了時、受入(Excel検収の手順と結果を含む)を `docs/logs/` に保存してコミットすること。検収用代表データの作成手順(6セクター各1シナリオ+3銘柄ポートフォリオ)を報告に含める。

---

*v1.0 — 2026-07-14。Phase 5-A 設計セッション(Fable)。コード変更なし。§8 の裁定後に Phase 5-B(実装、Sonnet)へ。*
*v1.1 — 2026-07-14。P5-1〜P5-9 の裁定(全項目推奨案採用、docs/logs/phase5-rulings-20260714.md)を転記。U-23/U-24 確定。§9 指示書はこのまま使用可。*
