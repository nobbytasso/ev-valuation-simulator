# Phase 3 再監査報告書(消込検証・ゲート判定)

日付: 2026-07-13 / 監査範囲: `e6581fc..HEAD`(80bbc97 時点)
方法: 読み取り・分析・挙動検証のみ(コード修正なし)。判定基準は「指摘された事象が再現しないこと」。修正コミットの存在やログの記載は根拠として扱わない。
前回レビュー: `docs/review-phase3.md`(対象コミット e6581fc)

**前提資料についての注記**: 監査指示にあった「修正完了ログ」「裁定文書」は独立ファイルとしてリポジトリに存在しない(docs/ 配下は review-phase3.md / requirements-rev5.md / engine-spec.md / cowork-benchmark-task.md のみ)。裁定はコミット 281ce49(Rev.5)・d8c6ec9(engine-spec v0.4)に直接反映されており、実施側の自己申告は各修正コミットのメッセージに記載されている。本監査はコミットメッセージを自己申告ログの代替として扱い、その主張を反証可能な仮説として検証した。→ 別ファイルとして存在する想定であれば**要ユーザー確認**。

## 検証環境の状態(ゲート条件の機械的確認)

- `npm run typecheck` / `npm run lint` / `npm run test`: **すべて通過**(27ファイル・284テスト全Green)
- golden fixture: e6581fc 以降の変更は `media_tech.golden.json` のみ(c7711bb、D-3の境界ケース追加分)。D-6コミット(80bbc97)での golden 変更は**なし**
- エンジン純粋性: `src/engine/` に Date / Math.random / DOM / localStorage / React への依存なし(grep 確認。ヒットは types.ts の注記コメント1件のみ)

---

## 1. 消込マトリクス

判定: **[解消]** / **[部分解消]** / **[未対応]** / **[意図的見送り]**(裁定・Rev.5に根拠があるもの)

### D系(修正提案)

| # | 判定 | 根拠(ファイル・確認内容) |
| --- | --- | --- |
| D-1 | **[解消]** | `src/store/scenarioMigration.ts`(v1→v2パイプライン、schemaVersion未設定=v1扱い)+ `LocalStorageAdapter` に migrate 注入(`scenarioStore.ts:99`)。**ロード経路**(readAll→list/load)・**インポート経路**(import)の両方が同じ migrate を通ることをコードで確認。回帰テスト: `scenarioMigration.test.ts`(冪等性含む4件)、`LocalStorageAdapter.migration.test.ts`(両経路+新旧混在+破損1件スキップ)、`legacyScenarioMigration.e2e.test.tsx`(Phase 2形式の生データを localStorage に置き、VC法セクションが例外なく描画されることを画面レベルで検証)。fixture `legacy-scenario-v1.json` は vcMethod/schemaVersion なしの正しい Phase 2 形状。portfolio 側も同様(`portfolioMigration.ts` + テスト3件)。新規作成(`defaultInputs.ts:159`)・インポートとも schemaVersion 付与を確認 |
| D-2 | **[解消]** | engine-spec §0.2.1 の制約表と6セクター実装を1対1照合し**全項目一致**(SaaS: arrGrowth>-1/margin[-1,1]/decay(0,1]、EC: f2Rate[0,1)/inventoryTurnover>0、医療機器: recurringRatio[0,1)/r>g_term、メディア: churn等[0,1]+mau≥0、クライメート: costDeclineRate[0,1)/rampYears≥1整数、創薬: 確率[0,1]/durations≥1整数、いずれも `validation.ts` の共通ヘルパー経由・複数違反全件列挙)。ドメイン外→ok:false のプロパティテスト(fc.assert × domainViolations)を**6セクター全部**に確認。フォーム min/max も6フォーム+DrugAssetForm に付与され、%換算後の範囲が spec と一致(例: EC f2Rate max="99.9"% = [0,1)、SaaS growthDecayFactor min 0.01/max 1 = (0,1])。挙動検証: 全プリセット18件+既定入力6セクターが ok:true(後述の二次影響検査) |
| D-3 | **[解消]** | Python `media_tech.py` は cpa>0 ガードを paybackMonths から外し `net_arpu > 0` ガードに変更 → TS実装(`mediaTech.ts`)・spec §2.4/§0.2.1 と**3者一致**(cpa=0 でも出力、分母0はキー省略、ltv=0/ltvCpaRatio=0出力)。境界ケース `cpa-zero` / `net-arpu-zero` を `boundary_cases.py` に追加済み。**golden再生成のタイミング**: コミット順は D-2(7a81379→7c93b29→9103083)→ D-3(c7711bb)で、再生成は c7711bb の**1回のみ**。9103083(サンプリング範囲ガード)は「既存ケースは全件ドメイン内で golden 差分なし」と申告どおり golden 変更なし(git stat で確認)。以降 golden の変更なし。キー集合比較は saas/ecD2c/mediaTech/drugDiscovery の4セクターに存在(※医療機器・クライメートは両実装とも keyMetrics 空のため比較テストなし — 潜在ギャップとして §3 に記載) |
| D-4 | **[解消]** | `BenchmarkComparisonSection.tsx:53-60` で industry_standard に加え comp_company も企業名+出典+取得日を表示 |
| D-5 | **[解消]** | `Header.tsx:19,34` で全セクターのベンチマークを走査し、1件でも dummy があればヘッダーに `DummyDataBadge` を常設。`Header.test.tsx` あり |
| D-6 | **[解消]**(付帯指摘4件、§2参照) | `drugDiscovery.ts` に `DRUG_DISCOVERY_SENSITIVITY_DRIVERS(inputs)` / `applyDrugDiscoveryDriver` / `drugDiscoveryBaseEv` の3点セット。spec §1.5.1 と実装の照合・挙動検証の詳細は §2 |
| D-7 | **[解消]** | EC②: f2Rate=0.28 = ダミー業界標準 f2_conversion 28%(値をJSONと突合済み)。創薬①: preclinical/phase1/phase2 = 65/52/29% 完全一致、phase3=0.58/0.85 × filing=0.85 → **積=58%** = pos_p3_to_approval 58% に完全一致。両プリセットファイル冒頭に Rev.5 §3 の値ポリシーと参照日(2026-07-13)を明記 |
| D-8 | **[解消]** | `MediaTechForm.tsx:98` のラベルが「売上予測年数」に修正済み(「DCF予測年数」は残存なし) |
| D-9 | **[解消]** | エンジン側公開ヘルパー化: `computeAssetPos`(創薬)/`retentionAfterMonths`(メディア)/`penetrationAtYear`(医療機器)。UI側は3箇所ともヘルパー呼び出しに置換(`DrugDiscoveryScenarioView.tsx:98`、`mediaTechBenchmarkMetrics.ts:25`、`medicalDeviceBenchmarkMetrics.ts:30`)。旧 `computePos` 等の式複製の残骸は grep でゼロ。keyMetrics に含めない方式のため golden 不変(方針コメントあり) |
| D-10 | **[解消]** | ログの主張「v1.2で修正済み」を原文照合で確認: `benchmark.schema.json` の metric_id description は「本体UI層のマッピング表(src/ui/sectors/*/…BenchmarkMetrics.ts)が対応付けるキー…エンジンのドライバーID(camelCase)とは命名規則が異なり、直接一致しない」と**UIマッピング表方式の記述に改訂済み**。`cowork-benchmark-task.md` の「metric_id の契約」節も同内容で矛盾なし(既存 metric_id 変更禁止・新規追加はマッピング表とセット、の運用ルール付き) |
| D-11 | **[解消]** | Rev.5 でフェーズ割当を明記: 並列比較ビュー→Phase 5(§4.1.1/§9)、金額単位切替→Phase 6(§1/§9)、期待IRR/MOIC表示→Phase 4(§3共通オーバーレイ/§9) |
| D-12 | **[解消]**(設計上の留意点は §3) | `src/ui/useStableListKeys.ts`(uuid独立管理+`keys[i] ?? String(i)` フォールバック)。消費側: DrugDiscoveryForm(品目)・ClimateTechForm(CAPEX行)。テスト3件(中間削除で後続キー不変=行ズレ対策の本質を直接検証)。**共有モジュール配置**: `src/ui/` 直下でセクター非依存 → Phase 4 のラウンド行UIから再利用可能 ✓ |
| D-13 | **[意図的見送り]** | Rev.5「低優先レビュー指摘のトリアージ」節+Phase 6行に「basis/notes/as_of表示」を吸収と明記 |
| D-14 | **[意図的見送り]** | 同上(years/count単位サフィックスは Phase 6)。なお v1.2 の新 unit `jpy` は BenchmarkBar が「円」サフィックス付きで表示対応済み(§3参照) |
| D-15 | **[意図的見送り]** | Rev.5 トリアージ節に「放置可、他セクターが auxiliary を返した時点で再評価」と明記 |
| D-16 | **[意図的見送り]** | Rev.5 トリアージ節+engine-spec §0.2 の SectorValuationResult 注記(Phase 6 チャートで使用想定、未使用なら削除検討)の**両文書**に残置方針を明記 |

### A系(要件からの乖離)

| # | 判定 | 根拠 |
| --- | --- | --- |
| A-1 | **[解消]** | D-4 に同じ |
| A-2 | **[解消]** | D-5 に同じ(アプリレベル常設で「常時」を充足) |
| A-3 | **[意図的見送り]** | Rev.5 §3 共通オーバーレイに「期待IRR/MOIC表示は Phase 4 の資本政策シミュレーター連動で充足」と明文化(裁定反映) |
| A-4 | **[意図的見送り]** | Phase 5 に正式割当(Rev.5 §4.1.1/§9) |
| A-5 | **[意図的見送り]** | Phase 6 に正式割当(Rev.5 §1/§9) |
| A-6 | **[意図的見送り]** | D-13 として Phase 6 に吸収 |
| A-7 | **[解消]** | D-10 に同じ(スキーマ v1.2 で契約文言を実装に合わせて修正) |

### B系(セクター間不整合)

| # | 判定 | 根拠 |
| --- | --- | --- |
| B-1 | **[解消]** | D-6 に同じ(3点セットが6セクター揃った) |
| B-2 | **[未対応]** | keyMetrics 表示粒度の不統一(メディアの paybackMonths 非表示等)は変更なし・Rev.5のトリアージ節にも記載なし。前回報告書のD系修正提案に含まれなかったため**トリアージ漏れ**の可能性 → 要ユーザー確認(低優先。Phase 6 の表示密度検討に吸収するのが自然) |
| B-3 | **[解消]** | D-9 に同じ |
| B-4 | **[解消]** | D-3 に同じ(Python側修正・spec明確化・境界golden追加) |
| B-5 | **[解消]** | D-7 に同じ+Rev.5 §3 に値ポリシー明文化 |
| B-6 | **[解消]** | D-8 に同じ |
| B-7 | **[部分解消]**(残部は意図的見送り) | unit `"jpy"` をスキーマv1.2に追加、ダミーJSONの arpu_monthly_jpy が unit:"jpy" に移行、UIマッピング表(`mediaTechBenchmarkMetrics.ts:17`)・`BenchmarkBar.tsx:22,31`(「円」表示)まで追随済み。years/count のサフィックス表示のみ D-14 として Phase 6 送り(文書化済み) |
| B-8 | **[解消]** | D-12 に同じ |
| B-9 | **[解消]** | D-2 に同じ |

### C系(独自判断の裁定)

| # | 判定 | 根拠 |
| --- | --- | --- |
| C-1 | **[意図的見送り]**(裁定=現状維持) | assets[0] のみ比較を継続。`drugDiscoveryBenchmarkMetrics.ts` 冒頭に方針コメント(複数品目の内訳比較は Phase 6 以降で検討)。推奨どおり |
| C-2 | **[解消]** | Rev.5 §6.1 に比較対象外4指標と理由を明記。cowork依頼票で definition 必須化(裁定(a))+医療機器 implied マルチプルをバックログに登録(裁定(b)、Phase 5前後) |
| C-3 | **[解消]** | Rev.5 §6.1 に派生指標の導出式一覧を「仮確定」として明記(definition 納品で確定する運用) |
| C-4 | **[解消]** | 比較値を `launchYear + approvalDelayYears` に変更(`medicalDeviceBenchmarkMetrics.ts:22`、Class III のみ)。Rev.5 §6.1 に「review-phase3.md C-4 の代替案(累積duration)は医療機器にフェーズ構造がないため誤り」との訂正注記付きで定義変更を記録 — 文書と実装が一致 |
| C-5 | **[解消]**(裁定=現状維持の明文化) | `ecD2cBenchmarkMetrics.ts:45` で multipleBasis='revenue' のときのみ比較+Rev.5 §6.1 に明記 |
| C-6 | **[解消]** | `DrugAssetForm.tsx:35` でマイルストーン選択肢を「残フェーズ+上市時」に制限(コミット 1d1798d)。エンジン側の過去フェーズ扱い(t=0・確率1、TODO)は防御として残置 — 推奨どおりUI制限で穴を塞いだ |
| C-7 | **[解消]** | 6セクター全ビューで「プリセット適用はdraftの差し替えのみ(保存は保存ボタン)」を確認(grep で6ファイル一致、プリセットからの直接 onSave 呼び出しゼロ) |
| C-8 | **[解消]** | D-10 に同じ(裁定(a)=スキーマ文言修正を採用) |
| C-9 | **[解消]** | 創薬③プリセット説明文が「Phase2成功確率が業界標準29%→5%に大幅低下」と数値明記(裁定どおり確率5%方式を維持) |

---

## 2. D-6(創薬感度分析)の実装検証

監査では静的照合に加え、エンジンを直接実行する挙動検証(スクラッチプローブ)を行った。

### 2-1. spec §1.5.1 との完全照合 — **一致**

| spec の定義 | 実装 | 判定 |
| --- | --- | --- |
| `assets[<i>].peakSales`: 相対±δ、下限0クランプ | `Math.max(peakSales × m, 0)` | ✓ |
| `assets[<i>].launchYear`: 相対±δ→四捨五入整数化、下限1 | `Math.max(Math.round(launchYear × m), 1)` | ✓ |
| `assets[<i>].phaseSuccessProbs.<phase>`: 相対±δ、[0,1]クランプ | min/max クランプ | ✓ |
| contributionMargin(own時のみ)/ royaltyRate(license時のみ): 相対±δ、[0,1] | 型判別つき適用、型不一致は無視(テストで確認) | ✓ |
| `discountRate.base`: ポイント変動 ±δ_r=0.02、下限 max(r, 0.001) | multiplier の符号のみ抽出し ±0.02 加減算、下限 0.001 | ✓(※δ_r「変更可」は未実装 → 2-2参照) |
| 列挙は品目数比例・件数制限はUI責務 | 全件返却 | ✓ |
| 純粋関数・入力非破壊・正規表現パース可 | 新オブジェクト返却(プローブで元入力の非破壊を確認) | ✓ |

### 2-2. 仕様外判断「残フェーズのみ対象」

- **(a) 技術的妥当性: 妥当**。`computeAssetRnpv` は `computePhaseTiming` 経由で `remaining = PHASE_ORDER.slice(idx)` のみを参照し、完了フェーズの確率は計算に一切使われない。挙動検証: 完了フェーズ(currentPhase=phase2 の preclinical)の確率を applier で手動変動させても **EV は完全に不変**であることを実行確認。含めれば span=0 の無意味ドライバーになるだけで、除外は正しい。
- **(b) engine-spec への追記: 未反映**。§1.5.1 の driverId 一覧は `phaseSuccessProbs.<phase>` とだけ書かれ、残フェーズ限定の記載がない。判断根拠はコード内コメント(`drugDiscovery.ts:210-212`「仕様書に明記なし → 実装判断」)にのみ存在する。**「spec片側未反映」として指摘する**(コード内コメントは文書化の代替にならない)。→ ゲート条件1

### 2-3. インターフェース非対称(Phase 4 の消費側契約)

- 他5セクター: `SECTOR_SENSITIVITY_DRIVERS` は **`as const` の静的配列**。創薬のみ **`(inputs) => string[]` の動的生成関数**。命名は大文字スネークで揃うが**型カインドが異なる**。
- 共通部分は成立: applier は6セクターとも `DriverApplier<TInputs>` 互換のシグネチャ、baseEv は6セクターとも `(inputs) => Money`(ドメイン外で NaN)。`buildTornado` は `driverIds: string[]` を受けるため、**呼び出し側で「静的配列をspreadする/関数を呼ぶ」の分岐さえ吸収すれば統一的に扱える**。
- ただし**統一ラッパー(セクターID→3点セットを引くレジストリ等)は存在しない**。Phase 4 のトルネードUI実装が6セクター分の import 分岐を書くことになる。→ ゲート条件2(Phase 4 冒頭で消費側契約を先に設計する)

### 2-4. パス形式 driverId の頑健性・可読ラベル

挙動検証の結果:

- 存在しない asset index(`assets[9]`、`assets[-1]`)・不明 driverId → **同一参照をそのまま返す**(例外なし)✓。テストあり。
- **不正フェーズ名**(`assets[0].phaseSuccessProbs.bogusPhase`)→ 例外は投げず EV も不変だが、**「そのまま返す」ではなく phaseSuccessProbs に `bogusPhase: NaN` という不正キーを持つ新オブジェクトを返す**(`startsWith('phaseSuccessProbs.')` 分岐がフェーズ名を検証しないため)。評価は PHASE_ORDER のキーのみ参照するため ok:true・EV不変で実害はないが、既知フェーズ名の検証がなく「安全な無視」契約と非一貫。テスト未カバー。→ §3 指摘(軽微)
- **人間可読ラベル: driverId 定義に含まれない**。driverId はパス文字列のみで、品目名(`assets[i].name`)やドライバー名の日本語ラベルを返す仕組みはエンジン側にない(他5セクターも同様に生ID)。品目名は `inputs.assets[i].name` から index で引けるため実装可能だが、トルネードチャートの表示ラベルは **Phase 4 でUI層のマッピングを設計する必要がある**。→ ゲート条件2に含める

### 2-5. 感度の非自明性 — **挙動は良好、保証テストなし**

- 2品目(own+license、残フェーズ数違い、マイルストーン付き)の代表入力で全14ドライバーの span を実測 → **全件 span > 0**(span=0 の無意味項目なし)。「残フェーズのみ」判断の帰結として列挙全件が有効であることを実証。
- ただし**これを保証するテストは存在しない**(他セクターも同様だが、創薬は「残フェーズのみ」判断の根拠がまさに非自明性のため、回帰テストとしての価値が最も高い)。
- 縮退の注意: `launchYear` が小さい場合(例: 2)は ±20% が四捨五入で消え span=0 になり得ることを実測確認(round(1.6)=round(2.4)=2)。仕様(整数化)の帰結であり欠陥ではないが、UI側で「感度なし」表示になるケースとして認識しておくべき。

### 2-6. テスト水準の同等性 — **概ね同等、統合テスト1点欠落**

追加7テストの内訳(`drugDiscovery.test.ts` の感度 describe):

1. 列挙: 残フェーズのみ+own/license分岐+discountRate.base(2品目で期待配列を完全一致検証)
2. peakSales/launchYear の相対変動・下限クランプ・整数化
3. phaseSuccessProbs の [0,1] クランプ+**指定 asset 以外は同一参照のまま**(非破壊)
4. contributionMargin/royaltyRate の own/license 双方適用+型不一致で無視
5. discountRate.base のポイント変動±0.02・下限0.001・pess/opt不変
6. 不明 driverId・範囲外 index で同一参照返却
7. baseEv の値一致+ドメイン外で NaN

適用→EV変化・クランプ・往復整合(applier単体)は他セクターと同等以上。**欠けているのは buildTornado との統合テスト**(他5セクターは「δ=0 で全 span=0」の P14 統合テストを持つが創薬にはない)。挙動は監査プローブで δ=0 → 全 span=0 を確認済みだが、回帰防止のためテスト追加が望ましい。→ ゲート条件3

### 2-7. エンジン純粋性・golden 不変 — **維持**

- D-6 コミット(80bbc97)の変更は `drugDiscovery.ts` + `drugDiscovery.test.ts` の2ファイルのみ。golden 変更なし(git stat で確認)✓
- 動的生成・正規表現(`ASSET_DRIVER_RE`)導入後も Date/random/DOM 依存なし(grep 確認)。正規表現はトップレベル定数でステートレス(`exec` 使用、`g` フラグなしのため lastIndex 問題もない)✓

---

## 3. 二次影響・文書不整合の指摘

### 二次影響(挙動検証済み)

1. **プリセット×バリデーション: 問題なし**。全18プリセット+新規作成時の既定入力6セクターをエンジンに通し、**全件 ok:true** を実行確認(D-2 の追加バリデーションとの矛盾なし)。
2. **エクスポート/インポートのラウンドトリップ: 問題なし**。新規作成・移行後データとも schemaVersion が付与され(`defaultInputs.ts:159`、migrate 出口)、export は保存済みオブジェクトをそのまま直列化、import は migrate(v2 では冪等)+新ID採番。テストあり(`LocalStorageAdapter.test.ts:35`、migration.test インポート経路)。
3. **D-9 の式複製排除: 完了**。旧 `computePos` 等の残骸 grep ゼロ。3箇所ともエンジンヘルパー経由。
4. **v1.2 追随: データ・表示とも追随済み**。ダミーJSON全6セクター schema_version "1.2"、arpu_monthly_jpy が unit:"jpy"、`adapters/benchmarks/types.ts` に jpy 追加、`BenchmarkBar` が jpy を「円」表示。years/count のサフィックスなしは D-14(Phase 6)の意図どおり。
5. **useStableListKeys の脱同期検討**(WeakMap方式からの設計変更): 現方式は「キー列を行データと独立に uuid で持ち、add/remove のみ同期、バルク差し替え時は `keys[i] ?? String(i)` フォールバック」。批判的検討の結果:
   - プリセット適用・シナリオ切替・インポート・マイグレーション経由ロードのいずれで行配列が丸ごと差し替わっても、**キーの重複や例外は発生しない**(uuid とフォールバック "0","1"… は衝突しない)。行データは完全 controlled(DrugAssetForm・CAPEX行とも行内ローカル state なし)のため、キーが旧行の識別子を引き継いでも**表示データの脱同期は起きない**。
   - 残る理論的劣化: バルク差し替えで行数がキー数を超えた場合、超過行は index キーにフォールバックし、その状態で中間行を削除すると超過行のキーが位置シフトする(= D-12 が排除したかった index キー相当の挙動に局所的に戻る)。実害は React の再マウント(フォーカス喪失)程度で、データ破壊はない。**Phase 4 のラウンド行UIで再利用する際は、バルク差し替え時にキー列をリセットする補助(例: reset(count))を足すとより頑健**(現状は許容範囲)。
   - シナリオ切替は ScenarioDetailPage がビューを scenario.id で key しておらず再マウントされないため、フォールバック経路が実際に通る。上記のとおり実害なしと判断。

### 文書間不整合(新規発見。すべて e6581fc..HEAD の変更に関連)

6. **【spec片側未反映】残フェーズ限定判断**(§2-2)。engine-spec §1.5.1 に追記が必要。
7. **U-20 の「変更可」が未実装**: spec は「δ_r 既定0.02、**変更可**」だが実装はハードコード(`DELTA_R = 0.02`)。コード内 TODO で「可変化は DriverApplier 型のシグネチャ拡張が必要、Phase 4 着手時に要相談」と明示されており、U-20 自体が仮採用のため軽微。ただし spec 側にも「Stage 1 実装は固定値、可変化は Phase 4 で決定」の旨を反映しないと spec が実装より先行した状態が残る。
8. **engine-spec §1.5.1 の「実装は Phase 4」記述が古い**: D-6 で Phase 3 末に前倒し実装済み。1行の追記(実装済みの旨)が望ましい。
9. **engine-spec 冒頭が「requirements-rev4.md を正とし」のまま**: CLAUDE.md・Rev.5 は rev5 を正と定めており矛盾。参照を rev5 に更新すべき(内容上の矛盾は §1.5.1 以外に見当たらない)。
10. **UIマッピング表6ファイルのヘッダコメントが「benchmark.schema.json (v1.1)」参照のまま**(saas/ecD2c/mediaTech/medicalDevice/drugDiscovery/climateTech の各 BenchmarkMetrics.ts)。実体は v1.2 に追随済みでコメントのみの齟齬。
11. **医療機器・クライメートの golden テストに keyMetrics キー集合比較がない**: 現状は TS/Python とも keyMetrics 空で問題ないが、バックログの implied EV/売上マルチプル追加(Phase 5前後)で医療機器に keyMetrics が生えた際、D-3 型の乖離を検出できない。実装時に他4セクターと同じキー集合比較を足すこと。
12. **applyDrugDiscoveryDriver の不正フェーズ名で NaN キー混入**(§2-4。EV不変・例外なしで実害は限定的)。
13. **B-2(keyMetrics 表示粒度)がトリアージから漏れている**(§1 B-2 参照)→ 要ユーザー確認。

D-13/D-14/D-15/D-16 の「文書明記のみでクローズ」は、Rev.5 のフェーズ表(Phase 6 行)と「低優先レビュー指摘のトリアージ」節に**実在することを原文確認済み**。D-16 は engine-spec §0.2 側にも注記があり両文書一致。

---

## 4. Phase 4 着手準備の確認とゲート判定

### 着手準備チェック

| 項目 | 状態 |
| --- | --- |
| 感度3点セット×6セクター | ✓ 揃った(創薬のみ動的生成関数。§2-3 の型カインド非対称あり) |
| 消費側の共通契約 | △ buildTornado への接続は6セクターとも可能だが、統一ラッパー・表示ラベルのマッピングは未設計(Phase 4 冒頭タスク) |
| 変動規則の spec 定義 | ✓ §1.5(相対±20%+クランプ、U-15)+§1.5.1(創薬のポイント変動、U-20)で全ドライバー分定義済み。残フェーズ限定のみ spec 未記載(条件1) |
| 資本政策の前提エンジンAPI | ✓ `irrBisection` / `irrClosedFormSingle` / `moic`(npv.ts)、`computeDilution` 系(dilution.ts)、`DilutionInputs.exit`(Exit企業価値の受け渡し)が実装・テスト済み(P11/P12 相当、npv/dilution/vcMethod の各テスト Green) |

### ゲート条件の判定

| 条件 | 結果 |
| --- | --- |
| golden 全一致 | ✓(284テスト中の golden 突合全Green、e6581fc 以降の golden 変更は D-3 の media のみで再生成1回) |
| 全プロパティ Green | ✓ |
| 旧データ回帰テスト Green | ✓(ロード/インポート/E2E の3層) |
| D-1・D-2・D-3・D-6 すべて[解消] | ✓(D-6 は機能・テストとも解消。付帯指摘は文書・テスト補強レベル) |
| 二次影響の重大指摘なし | ✓(§3 はすべて軽微または文書レベル) |

### 判定: **条件付きGO**

Phase 4 の実装を止めるブロッカーはない。ただし以下を条件とする(いずれも小規模):

1. **engine-spec §1.5.1 に「phaseSuccessProbs は残フェーズ(currentPhase以降)のみ列挙する」を追記**(§2-2。あわせて「実装済み」への記述更新と、U-20 固定値実装の現状注記=指摘7・8を同時に処理)。Phase 4 着手前の docs コミット1件で完了する。
2. **Phase 4 の最初の設計タスクとして、感度分析の消費側契約を確定する**: セクターID→(driverIds取得, applier, baseEv)のレジストリまたはラッパー、driverId→表示ラベル(創薬は品目名+ドライバー名)のマッピング、δ_r 可変化(U-20)の要否。§2-3・§2-4 の非対称をUI実装前に吸収する。
3. **創薬の buildTornado 統合テストを追加**(δ=0 で全 span=0、列挙全ドライバーの span > 0)。挙動は本監査で実証済みのため、回帰防止目的。Phase 4 のトルネード実装と同時でよい。

要ユーザー確認(判定保留):

- 「修正完了ログ」「裁定文書」が別ファイルとして存在する想定か(本監査はコミットメッセージ+Rev.5/spec 反映内容で代替検証した)
- B-2(keyMetrics 表示粒度)のトリアージ方針(Phase 6 吸収を推奨)
- 指摘12(不正フェーズ名の NaN キー混入)を修正するか、契約(列挙された driverId のみ渡す)を前提に許容するか

*本報告書は読み取り・分析・挙動検証のみで作成(製品コード・テスト・文書への変更なし)。挙動検証に使用したプローブはセッションのスクラッチ領域にのみ存在する。*
