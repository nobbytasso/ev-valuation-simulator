# Phase 4 設計書(phase4-spec)v1.0 — 感度分析トルネード + 資本政策シミュレーター

日付: 2026-07-13 / セッション: Phase 4-A(設計のみ。コード変更なし)
正とする文書: `docs/requirements-rev5.md` §4.1.5・§4.1.6・§3共通オーバーレイ、`docs/engine-spec.md` §1.3〜§1.5.1
前提監査: `docs/audit-phase3-v2.md` §2-3/§2-4/§2-5/§3-5/§4(ゲート条件2・3)、`docs/logs/wp-a-audit-cleanup-20260713.md`

本書は Phase 4 実装(別セッション、Sonnet)の設計仕様である。§8 の未確定事項が裁定されるまで実装に着手しないこと。engine-spec.md への追記案は §7 に差分として記載し、本設計時点では engine-spec 本体を編集していない。

---

## 0. 設計調査で判明した重要事実(実装前に共有すべきもの)

### 0.1 【重要】構造的 span=0 ドライバーの存在(→ 未確定事項 P4-1)

現行の `SENSITIVITY_DRIVERS` には、**base EV に一切影響しないドライバーが6件含まれている**。各セクターの `baseEv` はマルチプル評価の `ev.base` を返すが(`saasBaseEv` 等)、以下のドライバーは `auxiliary`(簡易DCF)または `keyMetrics`(診断指標)にしか影響しない:

| セクター | ドライバー | 影響先(EVには無影響) |
| --- | --- | --- |
| SaaS | `discountRate` | auxiliary(簡易DCF)のみ |
| SaaS | `fcfMargin` | auxiliary(簡易DCF)のみ |
| メディア | `monthlyChurn` | keyMetrics(LTV系)のみ |
| メディア | `cpa` | keyMetrics(LTV系)のみ |
| EC/D2C | `f2Rate` | keyMetrics(LTV系)のみ |
| EC/D2C | `aov` | keyMetrics(LTV系)のみ |

これらは `buildTornado` に通すと**入力値に関わらず常に span=0** となる(コード照合により確認: `evaluateSaas` の `ev` は `arrBasisValue × evArrMultiple` のみ、`evaluateMediaTech` の `ev` は `revenue1 × evSalesMultiple` のみ、`evaluateEcD2c` の `ev` は `basisNtm × evMultiple` のみ)。既存テストは「span ≥ 0」しか検証していないため検出されていない。医療機器・クライメート・創薬の全ドライバーと、SaaS/メディア/EC の残り各2件は EV に影響する。

さらに条件付きの類例として、**SaaS の `arrGrowth` は `arrBasis = 'current'` のとき span=0** になる(マルチプル基準が実績ARRのため)。こちらは入力条件依存であり、§3.4 の「感度なし」表示で扱う。

6件の恒常 span=0 ドライバーの扱いは金額表示の意味に関わるため、未確定事項 P4-1 として裁定を求める(推奨: SENSITIVITY_DRIVERS から削除)。**→ 裁定(2026-07-13): 削除で確定**(`docs/logs/phase4-rulings-20260713.md`。C4 のUIへの注記表示の追加指示あり、§3.1)。

### 0.2 用語・実名の対応

- 監査報告・タスク指示にある「computeDilution」の実体は `simulateDilution`(`src/engine/common/dilution.ts:120`)。
- 希薄化・VC法・IRR には Python 参照実装と golden fixture が**存在しない**(golden は6セクターのみ。希薄化はプロパティテスト P11/P12 でカバーする既存方針)。Phase 4 のエンジン追加(§4.5)も同方針を踏襲し、golden への影響はない。
- `simulateDilution` は現状**入力バリデーションを持たない**。`n + p_tgt ≥ 1` のラウンド(調達比率+プール目標が100%超)を与えると希釈係数 k ≤ 0 となり既存株主の持分が0以下になるが、エラーにならず不正な結果を黙って返す(§4.5 でバリデーション追加を設計)。

---

## 1. T1: 感度分析の消費側契約(監査ゲート条件2の中核)

### 1.1 型カインド非対称の吸収 — 推奨案: 全セクターを `(inputs) => string[]` に正規化

5セクターは `as const` 静的配列、創薬のみ `(inputs) => string[]` の動的生成関数という非対称(audit §2-3)を、**レジストリ側で「定数関数へのラップ」により吸収する**。静的配列は「入力に依存しない定数関数」の退化ケースであり、消費側の型は関数形に統一するのが最小の共通汎化である。

```ts
/** レジストリの1エントリ。TInputs はセクターのエンジン入力型 */
interface SectorSensitivityEntry<TInputs> {
  listDriverIds: (inputs: TInputs) => string[]   // 静的セクターは () => [...XXX_SENSITIVITY_DRIVERS] でラップ
  applyDriver: DriverApplier<TInputs>            // エンジン既存(6セクターとも互換シグネチャ、audit §2-3確認済み)
  baseEv: (inputs: TInputs) => Money             // エンジン既存(ドメイン外は NaN)
  driverLabel: (driverId: string, inputs: TInputs) => string   // T2(§2)。未知IDは driverId をそのまま返す
}

/** SectorId → エンジン入力型 の対応(Scenario ユニオンと同じ対応。scenarioTypes.ts から導出) */
type SectorInputsMap = {
  saas_jp: SaasInputs
  drug_discovery: DrugDiscoveryInputs
  medical_device: MedicalDeviceInputs
  media_tech: MediaTechInputs
  ec_d2c: EcD2cInputs
  climate_tech: ClimateTechInputs
}

type SensitivityRegistry = { [K in SectorId]: SectorSensitivityEntry<SectorInputsMap[K]> }
```

**代替案A**(不採用推奨): エンジン側で6セクターの `SENSITIVITY_DRIVERS` エクスポートを全て関数形に統一する。エンジンの一貫性は上がるが、5セクターの公開APIとテストを書き換える破壊的変更であり、golden不変・既存テスト非破壊の原則(CLAUDE.md DoD)に照らしてコストが利得を上回る。
**代替案B**(不採用): レジストリ値を `string[] | ((inputs) => string[])` のユニオンで持ち、消費側で `typeof` 分岐。分岐漏れがコンパイル時に検出されず、監査 §2-3 が指摘した「呼び出し側の分岐」をレジストリの外に漏らすだけで解決にならない。

### 1.2 配置場所 — UI層(`src/ui/sensitivity/`)

**判断: レジストリは UI 層に置く。** 根拠:

1. レジストリのキーは `SectorId`(`'saas_jp'` 等)であり、これは `src/store/scenarioTypes.ts` が定義する**アプリケーション(永続化)層の語彙**。エンジンは依存ゼロ原則(CLAUDE.md 設計原則1)により store を import できず、逆にエンジン内に `'saas_jp'` 等の重複定義を作れば ID の二重管理になる。
2. 「スキーマ側の識別子 → エンジン関数/値」の対応付けは、既に確立した前例がある: ベンチマークの UI 層マッピング表(`src/ui/sectors/*/​*BenchmarkMetrics.ts`、requirements-rev5.md §6 v1.2 契約)。感度レジストリも同じパターンに従う。
3. レジストリ自体はデータと純粋関数のみで副作用を持たないため、UI 層に置いても「計算ロジックがUIに漏れる」ことにはならない。計算本体(applier/baseEv/buildTornado)はすべてエンジン側に既存であり、レジストリは**結線のみ**を行う。

配置:

```
src/ui/sensitivity/
  sensitivityRegistry.ts     # SensitivityRegistry 本体 + buildTornadoRows ファサード
  sensitivityRegistry.test.ts
  SensitivitySection.tsx     # T3 のトルネードUI
  SensitivitySection.test.tsx
```

ドライバーの日本語ラベル表は各セクターの既存ディレクトリに同居させる(§2.3)。

### 1.3 buildTornado への接続とUI呼び出しシーケンス

消費側の入口は、Scenario ユニオンの判別を1箇所に閉じ込めるファサード関数とする:

```ts
interface TornadoRow extends TornadoItem {
  label: string          // T2 で合成した日本語ラベル
  delta: Ratio           // この行に適用した変動幅(表示用)
  isFixedDelta: boolean  // 創薬 discountRate.base のみ true(δ_r=±0.02固定、WP-A確定裁定)
}

interface SensitivityRunConfig {
  defaultDelta: Ratio                        // 既定 0.20
  deltaByDriverId?: Record<string, Ratio>    // ドライバー毎の上書き(T3)
}

/** Scenario(draft入力差し替え済み)からトルネード行一式と基準EVを得る */
function buildTornadoRows(scenario: Scenario, config: SensitivityRunConfig):
  { baseEv: Money; rows: TornadoRow[] }
```

実装方針(シグネチャレベル):

- 内部は `switch (scenario.sector)` で6分岐し、各 case 内で `registry[sector]` のエントリと `scenario.inputs` を**完全に型付けされた状態で**接続する(`ScenarioDetailPage.tsx` の `SectorView` と同じディスパッチパターン)。TypeScript の相関ユニオン制約(レジストリを添字アクセスすると TInputs の対応が失われる)をこの1関数に隔離する。
- **ドライバー毎の変動幅は、`buildTornado` をドライバー単位(`driverIds: [id]`、`delta` 個別)で呼び分けて実現する**。エンジンの `SensitivityConfig` は単一 δ のままで変更不要。全行を結合後、span 降順で再ソートする(同値時は列挙順維持。`Array.prototype.sort` は安定ソート)。EV評価回数は 2×ドライバー数で一括呼び出しと同一のためコスト増なし。
  - 代替案(不採用): エンジンの `SensitivityConfig` を `{driverId, delta}[]` に拡張する。engine-spec §1.5 の改訂と既存6セクターのテスト修正を伴うが、UI側合成で同じ結果が得られるため不要。
- 創薬の `discountRate.base` は applier が multiplier の**符号のみ**を使い ±0.02 ポイント固定で変動する(U-20確定)。よってこのドライバーへの `deltaByDriverId` 上書きは無効であり、ファサードは `isFixedDelta: true` を立てて UI に編集不可を伝える。δ=0 のとき符号0 → 変動なし → span=0 となり P14 と整合。

UIからの呼び出しシーケンス:

1. 各セクターの ScenarioView が `<SensitivitySection scenario={{ ...scenario, inputs: draftInputs }} />` を描画する(draft 連動。保存前の入力変更が即座に感度分析へ反映される点は結果ビュー・VC法と同じ挙動)。
2. `SensitivitySection` はローカル state として `deltaByDriverId` と表示件数トグルを持つ(永続化は P4-2 裁定待ち)。
3. `useMemo` で `buildTornadoRows(scenario, config)` を呼び、`baseEv` が NaN(ドメイン外入力)の場合はチャートを描画せず「入力エラーのため感度分析を実行できません」を表示する(`EvRangeResult` の ok:false ガードと同等)。
4. 得られた行を §3 の表示規則(上限N・感度なしグループ)で描画する。

---

## 2. T2: driverId → 表示ラベルのマッピング設計

### 2.1 方式

- **静的5セクター**: `Record<DriverId, string>` の定数表。キー型を `(typeof SAAS_SENSITIVITY_DRIVERS)[number]` のように `as const` 配列から導出することで、**ドライバー追加・削除時にラベル欠落がコンパイルエラーになる**(網羅性の型保証)。
- **創薬**: パス形式 driverId をパースする合成関数。手順:
  1. `discountRate.base` → 「割引率(ベース)」を返す。
  2. `assets[<i>].<sub>` を正規表現でパースし、`inputs.assets[i].name` を取得(範囲外は driverId をそのまま返すフォールバック)。
  3. `<sub>` を下表で日本語化し、**「{品目名}: {ドライバー名}」** の形式で合成する(例: 「パイプライン品目A: ピーク売上」「品目B: フェーズ2成功確率」)。
- 未知の driverId は全セクター共通で **driverId 文字列をそのまま返す**(表示が壊れず、テストで検出可能)。

### 2.2 ラベル文言(既存フォームとの一貫)

既存フォームのラベルから単位・注記の括弧を除いた語を使う。同じ概念に別の日本語を使わない(検証: 下表はすべて各 Form.tsx の実ラベルと照合済み)。

| セクター | driverId | ラベル | 出典フォーム文言 |
| --- | --- | --- | --- |
| SaaS | `arrGrowth` | ARR成長率 | 「ARR成長率(YoY, %)」 |
| SaaS | `evArrMultiple.base` | EV/ARRマルチプル(ベース) | 「EV/ARRマルチプル(x)」+レンジ点 |
| SaaS | `discountRate` | 割引率(DCF) | 「割引率(DCF, %)」 |
| SaaS | `fcfMargin` | FCFマージン | 「FCFマージン(%, 簡易DCF用)」 |
| 創薬 | `assets[i].peakSales` | ピーク売上 | 「ピーク売上(百万円)」 |
| 創薬 | `assets[i].launchYear` | 上市年 | 「上市年(現在からの年数)」 |
| 創薬 | `assets[i].phaseSuccessProbs.<p>` | {フェーズ名}成功確率 | 「成功確率(%)」×PHASE_LABELS |
| 創薬 | `assets[i].commercialization.contributionMargin` | 貢献利益率 | 「貢献利益率(%)」 |
| 創薬 | `assets[i].commercialization.royaltyRate` | ロイヤリティ率 | 「ロイヤリティ率(%)」 |
| 創薬 | `discountRate.base` | 割引率(ベース) | 「割引率(%)」+レンジ点 |
| 医療機器 | `peakPenetration` | 最大浸透率 | 「最大浸透率(%)」 |
| 医療機器 | `approvalDelayYears` | 承認遅延年数 | 「承認遅延年数」 |
| 医療機器 | `pricePerProcedure` | 手技あたり単価 | 「手技あたり単価(円、償還ベース)」 |
| 医療機器 | `procedureGrowth` | 手技数成長率 | 「手技数成長率(年率, %)」 |
| メディア | `mauGrowth` | MAU成長率 | 「MAU成長率(年率, %)」 |
| メディア | `evSalesMultiple.base` | EV/売上マルチプル(ベース) | 「EV/売上マルチプル(x)」 |
| メディア | `monthlyChurn` | 月次解約率 | 「月次解約率(%)」 |
| メディア | `cpa` | CPA | 「CPA(円)」 |
| EC/D2C | `revenueGrowth` | 売上成長率 | 「売上成長率(YoY, %)」 |
| EC/D2C | `evMultiple.base` | EVマルチプル(ベース) | 「EVマルチプル(x)」 |
| EC/D2C | `f2Rate` | F2転換率 | 「F2転換率(%)」 |
| EC/D2C | `aov` | 平均注文単価 | 「平均注文単価(円)」 |
| クライメート | `massProductionProb` | 量産化到達確率 | 「量産化到達確率(%)」 |
| クライメート | `subsidyCoverage` | 補助金カバー率 | 「補助金カバー率(%)」 |
| クライメート | `carbonCreditPrice` | カーボンクレジット価格 | 「カーボンクレジット価格(円/t-CO2)」 |
| クライメート | `unitPrice` | 販売単価 | 「販売単価(円/unit)」 |

※ P4-1 の裁定が「削除」の場合、SaaS `discountRate`/`fcfMargin`、メディア `monthlyChurn`/`cpa`、EC `f2Rate`/`aov` の6行は不要になる。

フェーズ名は `DrugAssetForm.tsx` にプライベート定数として存在する `PHASE_LABELS`(非臨床/フェーズ1/フェーズ2/フェーズ3/申請)を**共有モジュールに抽出して再利用する**: `src/ui/sectors/drugDiscovery/phaseLabels.ts` を新設し、DrugAssetForm と創薬ラベル関数の両方が import する(文言の二重定義を作らない。挙動変更なしの小リファクタ)。

### 2.3 配置とレジストリとの関係

- ラベル表・合成関数は各セクターのディレクトリに同居: `src/ui/sectors/saas/saasDriverLabels.ts` 等6ファイル(ベンチマークの `*BenchmarkMetrics.ts` と同じ配置規約)。
- レジストリ(§1.1)の各エントリが `driverLabel` としてこれらを参照する。**消費側(SensitivitySection)はレジストリのみに依存し、ラベル表を直接 import しない**(結線の一元化)。

---

## 3. T3: トルネードチャートのUI仕様(構造・データフローのみ。見た目は Phase 6)

### 3.1 コンポーネントとデータフロー

- `SensitivitySection`(`src/ui/sensitivity/`)。props: `scenario: Scenario`(draft 入力差し替え済み)。6セクターの ScenarioView が結果セクションの後(VC法セクションの前後どちらでも可、実装時に統一)に組み込む。
- チャートは Recharts の横棒(左右に伸びる2セグメント: baseEv → evAtLow、baseEv → evAtHigh)。基準線 = `baseEv`。色・演出のスタイリングは Phase 6 スコープであり、Phase 4 ではテーマトークン参照の素朴な描画に留める。
- 各行の表示要素: ラベル(T2)、evAtLow/evAtHigh(百万円)、span。`evAtHigh < evAtLow` となるドライバー(承認遅延年数・割引率等)もそのまま左右を描き分ける(engine-spec §1.5「方向はUI側で表現」)。
- **SaaS・メディア・EC/D2C のセクションには「マルチプル法のためユニットエコノミクス系ドライバー(解約率・CPA・F2転換率等)はEVに影響せず、感度対象外」の短い注記を表示する**(P4-1 裁定の追加指示。C4 で実装)。

### 3.2 変動幅の設定UI

- 既定 ±20%(`defaultDelta = 0.20`)。要件 §4.1.5「変更可」は、セクション内の設定行でドライバー毎に %入力できる形とする(`deltaByDriverId`)。全体一括変更の入力も置く(既定値の変更 → 個別上書きのないドライバーに適用)。
- 創薬 `discountRate.base` は ±2%ポイント固定(U-20確定・WP-A裁定済み)のため、**変動幅入力を編集不可とし「±2pt(固定)」と表示する**。δ_r 可変化の再検討はしない(禁止事項)。
- 定義域クランプ(U-15)により、±20% が定義域端で切られるドライバー(確率系で base が高い場合等)は evAtLow/evAtHigh が非対称になる。これは仕様どおりであり、UI は実際に評価された値をそのまま示す。
- **設定の永続化有無は未確定(P4-2)**。裁定までは「非永続(セッション内の component state のみ)」で設計する。

### 3.3 表示件数制限とソート規則

engine-spec §1.5.1 は件数制限をUI責務と定めている。創薬はドライバー数が品目数に比例する(1品目あたり最大8件 = ピーク売上・上市年・残フェーズ確率最大5・商業化1、+全体で割引率1件。例: 5品目で最大41件)ため:

- **ソート**: span 降順(エンジン出力の順序を維持)。span 同値は列挙順(= 品目順・ドライバー宣言順)。
- **上限**: 既定で span 降順の**上位10件**を表示し、超過分は「残りn件を表示」トグルで展開する。10件は静的5セクター(各4件)では発動せず、創薬2品目強から効き始める値。
- span=0 の行(§3.4)は上位N件の枠から除外して数える(意味のある感度を10件見せるため)。

### 3.4 span=0 ドライバーの扱い(監査 §2-5)

span=0 は2種類を区別する:

1. **構造的 span=0**(§0.1 の6件): P4-1 の裁定に従う。推奨(削除)が採用されればこの分類は発生しなくなる。
2. **縮退 span=0**(入力値依存): `launchYear` が小さく ±20% が四捨五入で消えるケース(audit §2-5: launchYear=2 → round(1.6)=round(2.4)=2)、SaaS `arrBasis='current'` 時の `arrGrowth`、base値が0のドライバー(0×(1±δ)=0)等。

縮退 span=0 の表示方針は **「非表示にせず、チャート下部に『この変動幅では感度なし』グループとしてラベルのみ列挙する」を推奨**(P4-3 として裁定対象)。根拠: 設定UIにはドライバーが存在するのにチャートから黙って消えると「計算されていない」ように見える。バー描画は省く(0幅のバーは描けない)がラベルと注記で存在を示す。

---

## 4. T4: 資本政策・希薄化シミュレーター

### 4.1 データモデル — Scenario への `capitalPolicy` 追加(schemaVersion v2→v3)

資本政策はシナリオ単位の入力である(Exit企業価値がシナリオの評価結果と連動するため、シナリオに従属させるのが自然。ポートフォリオ側 Phase 5 とは独立)。`Scenario` に必須フィールドとして追加し、**schemaVersion を 3 に上げる**:

```ts
/** 資本政策(Phase 4)。エンジンの CapTableHolder / FundingRound 型をそのまま再利用
    (scenarioTypes.ts の「エンジン入力型を二重管理しない」方針を踏襲) */
interface ScenarioCapitalPolicyInputs {
  initialCapTable: CapTableHolder[]   // 初期持分。Σ=1(UI検証+エンジン検証 §4.5)
  rounds: FundingRound[]              // 将来ラウンド列(空配列可)
  exitEvSource: 'pessimistic' | 'base' | 'optimistic'   // Exit企業価値の参照レンジ点(§4.2、P4-4)
}

interface ScenarioBase<...> {
  ...既存フィールド
  capitalPolicy: ScenarioCapitalPolicyInputs   // v3 で追加
}

const SCENARIO_SCHEMA_VERSION = 3
```

- **Exit年は `vcMethod.yearsToExit` を共用し、capitalPolicy には持たせない**(推奨。P4-5 として裁定対象)。`DilutionInputs.exit.yearIndex` へは `vcMethod.yearsToExit` を接続する。根拠: 「Exitまでの年数」という同一概念の二重入力を作ると、VC法の含意IRRと資本政策の期待IRRが**異なるExit時点**で計算される不整合が起こり得る。
- `CapTableHolder.id` は UI での行生成時に `crypto.randomUUID()` を振る(UI層の責務。エンジンは id を識別にのみ使用)。`FundingRound` に id フィールドはなく、行キーは `useStableListKeys` で管理する(§5)。

#### v2→v3 マイグレーション仕様(audit D-1 再発防止。型拡張と同時に必ず実装)

| 項目 | 仕様 |
| --- | --- |
| 変換 | `migrateV2ToV3(raw)`: `raw.capitalPolicy` が存在すればそのまま、なければ既定値を補完。`MIGRATIONS[2]` に登録し、`SCENARIO_SCHEMA_VERSION = 3` に更新 |
| 既定値 | `defaultCapitalPolicyInputs()`: `initialCapTable = [{ id: 'founders', name: '創業者', ownership: 1 }]`、`rounds = []`、`exitEvSource: 'base'`。`defaultInputs.ts` に置き、新規作成(`createScenario`)とマイグレーションの両方で使う(`defaultVcMethodInputs` と同じパターン) |
| 冪等性 | v3 データを再度通しても無変化(capitalPolicy 存在チェックにより保証)。既存の冪等性テストパターン(`scenarioMigration.test.ts`)に v3 ケースを追加 |
| 多段 | v1(Phase 2形式)→ v2(vcMethod補完)→ v3(capitalPolicy補完)の連鎖が1回の `migrateScenario` で完了すること。既存 fixture `legacy-scenario-v1.json` からの多段テスト+新規 fixture `legacy-scenario-v2.json`(vcMethodあり・capitalPolicyなし)からの単段テスト |
| ラウンドトリップ | export(v3)→ import → migrate が no-op であること(schemaVersion 一致で素通り)。`LocalStorageAdapter` のロード・インポート両経路は migrate 注入済み(`scenarioStore.ts:99`)のため**アダプタ側の変更は不要** |
| 影響範囲 | `PORTFOLIO_SCHEMA_VERSION` は変更なし(ポートフォリオ形式は不変)。既存テストの「schemaVersion = 2」期待値は 3 に更新する(意図的な更新であり破壊的変更にあたらない) |

### 4.2 Exit企業価値のシナリオ評価結果からの引用

VC法セクションで確立済みの規約(セクターモデルの EV レンジ = Exit時企業価値、`VcMethodSection.tsx` が `evRange[k]` を `exitEnterpriseValue` に接続)をそのまま踏襲する:

```
exit.equityValue = ev[exitEvSource] − vcMethod.netDebtAtExit     (§1.2 の exitEquityValue と同じ変換)
exit.yearIndex   = vcMethod.yearsToExit                          (P4-5)
```

- **既定は `base`、UI のセレクトで悲観/ベース/楽観を切替可能**とする(推奨。P4-4 として裁定対象。代替案: VC法テーブルと同様に3列並記)。切替はシナリオに保存される(`exitEvSource` フィールド)。
- `exit.equityValue ≤ 0` のとき(創薬・クライメートは負のEVを許容)は、シミュレーションを実行せず「Exit株式価値が0以下のため手取り・IRR/MOICを計算できません」と警告表示する(株式の有限責任の下で負の分配は生じないため)。エンジン側でも `equityValue ≥ 0` をドメイン制約に加える(§4.5)。この扱いは P4-4 の裁定に含めて確認を求める。
- 純有利子負債は `vcMethod.netDebtAtExit` を共用し、新しい入力は作らない。

### 4.3 出力(要件 A-3 の充足)

`CapitalPolicySection`(`src/ui/capitalPolicy/` 新設)が表示するもの:

1. **ラウンド毎の持分推移**: `DilutionResult.rounds[].capTableAfter` から、行=保有者(初出順)、列=「初期」+各ラウンド後、のマトリクス表。途中参加の保有者は参加前の列を空欄とする。
2. **Exit時の自社持分・手取り**: `exitCapTable` から isFund 保有者(複数ラウンド出資時は複数行)の実効持分合計と payout 合計。未消化プール失効・再正規化(U-14)はエンジン側で処理済み。
3. **期待IRR / 期待MOIC**: `fundIrr` / `fundMoic`(`fundCashflows` = 各ラウンドの `−fundInvestment` + Exit時 payout、§1.3 の二分法)。`null` のとき(自ファンド出資ゼロ等)は「—(自ファンドの出資がありません)」を表示。
4. **入力UI**: 初期資本政策の保有者行(名前/持分%/プール/自ファンドのフラグ)と、ラウンド行(ラウンド名/年/プレバリュー/調達額/プール目標%/自ファンド出資額)。どちらの行リストも `useStableListKeys` を再利用(§5)。

**既存 VcMethodSection との表示上の関係**: 両者は併存させ、意味の違いをキャプションで明示する。

- VC法セクション(既存): 「目標倍率が含意するIRR」= **目標から逆算した要求水準**(targetMultiple^(1/年数)−1。資本政策とは独立)。
- 資本政策セクション(新設): 「期待IRR/MOIC」= **入力した資本政策とシナリオ評価額から順算した予測値**。requirements-rev5.md §3「期待IRR/MOIC の表示は Phase 4 の資本政策シミュレーター連動で充足」(A-3裁定)はこちらで満たす。
- `vcMethod.investment`(今回投資額)と `rounds[].fundInvestment`(ラウンド毎の自ファンド出資)は目的が異なるため連動させない。`vcMethod.dilutionRetention` の自動連動も Phase 4 では行わない(P4-6 として裁定対象。推奨: 手入力のまま、資本政策セクションに参考値として「初回出資時持分→Exit実効持分の残存率」を表示するに留める)。

### 4.4 既存エンジンAPIの棚卸し

| 必要機能 | 既存API | 充足 |
| --- | --- | --- |
| ラウンド適用・持分推移 | `simulateDilution` → `DilutionResult.rounds[].capTableAfter` | ✓ そのまま使える |
| Exit時実効持分・手取り(プール失効・再正規化) | 同 `exitCapTable`(U-14実装済み) | ✓ |
| Exit企業価値の受け渡し | `DilutionInputs.exit: { yearIndex, equityValue }` | ✓(接続式は §4.2) |
| 期待IRR | 同 `fundIrr`(内部で `irrBisection`、§0.4 の二分法) | ✓ |
| 期待MOIC | 同 `fundMoic`(内部で `moic`) | ✓ |
| 入力ドメイン検証 | **なし**(§0.2 の ok:false 規約に対する例外状態) | ✗ → §4.5 で追加 |

### 4.5 エンジン追加: `validateDilutionInputs`(唯一の追加関数)

計算本体は追加不要で、**追加するのは入力バリデーション1関数のみ**。`simulateDilution` のシグネチャは変更しない(既存テスト非破壊)。UI はシミュレーション実行前にこれを呼び、issue があれば結果表示をエラー表示に差し替える(セクターフォームと同じ ok:false パターン)。

```ts
/** DilutionInputs のドメイン検証。違反は全件列挙(§0.2 と同じ規約)。 */
function validateDilutionInputs(inputs: DilutionInputs): ValidationIssue[]
```

検証項目(engine-spec 追記案 §7.1 に同文):

| 対象 | 制約 | 違反時の現行挙動(放置した場合) |
| --- | --- | --- |
| initialCapTable[].ownership | 各 [0,1] かつ Σ = 1(誤差 1e-9) | 前提崩れのまま計算(P11不変条件の前提外) |
| initialCapTable | isPool は高々1件 | `findIndex` が先頭プールのみ処理し2件目が放置される |
| rounds[].preMoneyValuation | > 0 | post ≤ 0 で除算異常 |
| rounds[].amountRaised | ≥ 0 | — |
| rounds[].optionPoolPostPct | [0, 1) | — |
| rounds[].fundInvestment | 0 ≤ x ≤ amountRaised | 持分合計が1を超える |
| rounds[] 各ラウンド | n + optionPoolPostPct < 1(n = amountRaised/post) | 希釈係数 k ≤ 0 → 既存株主持分が0以下(§0.2 参照) |
| rounds[].yearIndex | ≥ 0 の整数 | — |
| exit.yearIndex | ≥ max(rounds[].yearIndex) | Exit前の出資がExit後に計上されIRRが無意味化 |
| exit.equityValue | ≥ 0 | 負の分配額(§4.2) |

- **Python参照実装・golden への影響: なし**。希薄化は Phase 1 から golden を持たず(§0.2)、プロパティテストでカバーする方針を踏襲する。バリデーションは判定関数であり数値計算を含まないため、参照実装との突合対象にもならない。
- **プロパティテスト追加**(engine-spec §3 への追記案は §7.1):
  - P16: `validateDilutionInputs` が空配列を返す任意の入力に対し、全ラウンド後の全保有者 ownership ∈ [0, 1](P11 の「総和=1」を各保有者の非負性まで拡張)。
  - P17: 上表の各制約について、ドメイン外に外した入力 → issue が該当 field で列挙される(セクターの domainViolations テストと同型)。
  - 既存 P11/P12 は無変更で維持。

---

## 5. T5: useStableListKeys の reset() 仕様(監査 §3-5)

### 5.1 API契約

```ts
interface ListItemKeys {
  keys: string[]
  push: () => void
  removeAt: (index: number) => void
  reset: (count: number) => void   // 追加: 全キーを新規uuidでcount件再生成する
}
```

- **いつ誰が呼ぶか**: 行配列を add/remove 以外の経路で**丸ごと差し替えた直後**に、その差し替えを行ったコンポーネント(= フックを所有するコンポーネント)が `onChange` と対にして呼ぶ。具体的な発火点:
  - シナリオ切替による draft 再同期(所有コンポーネントが `scenario.id` の変化を検知する effect 内で `reset(次の行数)`)。
  - インポート・プリセット適用等のバルク差し替えハンドラ内。
- **呼び忘れ時の挙動(重要な契約)**: 現行のフォールバック `keys[i] ?? String(i)` が引き続き安全網として機能する。キー重複・例外・データ破壊は起きず、劣化は「はみ出した行の再マウント(フォーカス喪失)」に限られる(audit §3-5 で許容範囲と判定済みの挙動)。つまり **reset は「呼ばなくても安全、呼べば再マウントも防げる」という追加保証**であり、必須呼び出しではない。
- `reset(0)` は空リストへの差し替えに対応(keys = [])。

### 5.2 既存2コンシューマーへの影響 — 変更不要

DrugDiscoveryForm(品目)・ClimateTechForm(CAPEX行)は**変更しない**。理由: 両者ではバルク差し替え(プリセット適用・シナリオ切替)を行うのは親の ScenarioView であり、フックを所有する Form 側からは「編集による参照変化」と「バルク差し替え」を区別できない(編集のたびに配列参照が変わる完全 controlled 構造のため、effect での検知は不能)。audit §3 指摘5 が「現状は許容範囲」と判定した既存挙動を維持し、reset は**フック所有者自身がバルク差し替えの契機を知っている新規コンシューマー**(Phase 4 のラウンド行・保有者行)で使う。

### 5.3 Phase 4 の新規コンシューマーでの使用

`CapitalPolicySection` はラウンド行・初期保有者行の2リストでフックを2つ使い、`scenario.id` 変化時の draft 再同期 effect で両方 `reset(...)` を呼ぶ(§5.1 の発火点1)。これにより監査が指摘した「バルク差し替え後の中間削除でキーが位置シフトする」理論的劣化を新規UIでは排除する。

テスト: reset 後に全キーが新規であること / reset(0) / reset 後の push・removeAt が正常動作すること / 既存3テスト(中間削除でキー不変等)が無変更で Green のこと。

---

## 6. T6: テスト計画と実装順序(コミット分割)

実装セッションの最初のコミットは**監査ゲート条件3**と定める。以降は1機能1コミット、エンジンとUIは別コミット(CLAUDE.md)。各コミットの完了条件は共通で `npm run typecheck` / `lint` / `test` Green + golden 差分なし(明記した場合を除く)。

| # | コミット | 内容 | 固有の完了条件 |
| --- | --- | --- | --- |
| C1 | `test(engine): 創薬buildTornado統合テスト` | **ゲート条件3**。δ=0 で全 span=0(P14)/ 既定入力+2品目(own・license混在)で列挙全ドライバーの span > 0 / 件数 = 列挙数。`drugDiscovery.test.ts` に追加 | プロダクションコード変更なし。テストのみ |
| C2 | `feat(engine): 構造的span=0ドライバーの整理`(**P4-1裁定=削除。実施確定**) | SaaS/メディア/EC の SENSITIVITY_DRIVERS から6件削除+各テスト修正+engine-spec §1.5 同時更新(§7.2 削除版) | golden 差分なし(SENSITIVITY_DRIVERS は golden 非対象) |
| C3 | `feat(ui): 感度分析レジストリ+ラベル` | §1 レジストリ+ファサード、§2 ラベル表6ファイル+`phaseLabels.ts` 抽出(DrugAssetForm の import 差し替え含む)。テスト: 6セクターの列挙・全列挙IDに非フォールバックラベルが付くこと・創薬の品目名合成・未知IDフォールバック・ドライバー単位δ上書き・`isFixedDelta` | エンジン変更なし |
| C4 | `feat(ui): トルネードチャートセクション` | §3 SensitivitySection+6ビューへの組み込み+SaaS/メディア/ECのユニットエコノミクス系注記(P4-1追加指示)。テスト: 上位N制限とトグル・感度なしグループ・δ変更で再計算・ドメイン外入力でエラー表示・注記表示 | — |
| C5 | `feat(engine): validateDilutionInputs` | §4.5 検証関数+P16/P17+engine-spec §1.4 同時更新(§7.1) | golden 差分なし。`simulateDilution` シグネチャ不変 |
| C6 | `feat(store): Scenario v3(capitalPolicy)` | §4.1 型追加+`SCENARIO_SCHEMA_VERSION=3`+`migrateV2ToV3`+`defaultCapitalPolicyInputs`。テスト: v1→v3多段 / v2→v3(新fixture `legacy-scenario-v2.json`)/ 冪等 / ラウンドトリップ / LocalStorageAdapter両経路 / 既存の version=2 期待値の更新 | 既存 e2e(`legacyScenarioMigration.e2e.test.tsx`)Green 維持 |
| C7 | `feat(ui): useStableListKeys.reset` | §5。テスト4点+既存3テスト無変更Green | — |
| C8 | `feat(ui): 資本政策シミュレーターセクション` | §4.3 CapitalPolicySection+6ビュー組み込み。テスト: ラウンド追加/削除/持分推移表・exitEvSource切替・EV≤0警告・バリデーションエラー表示・期待IRR/MOIC表示・null時表示・scenario.id切替でreset発火 | 保存→再ロードで capitalPolicy が復元されること(コンポーネント/E2Eレベル) |
| C9 | `docs: Phase 4完了報告` | docs/logs/ へ受入確認報告を保存(CLAUDE.md セッション成果物ルール) | — |

依存関係: C1 は独立(最初に必須)。C2→C3→C4 が感度分析ストリーム、C5→C6→C7→C8 が資本政策ストリーム(C5とC6は独立だがUIのC8は両方に依存)。engine-spec の更新は対応するエンジンコミット(C2/C5)に同梱する(「確定後に本書と実装を同時更新」の既存規約)。

マイグレーション回帰テストの範囲(C6): `migrateScenario` 単体(多段・冪等)/ アダプタ両経路(既存 `LocalStorageAdapter.migration.test.ts` の拡張)/ E2E(v1生データからの画面描画、既存テストの期待値更新)。v1・v2 fixture は手書き(golden 生成対象ではない)。

---

## 7. engine-spec 追記案(裁定後、対応するエンジンコミットで本体に反映)

### 7.1 §1.4 希薄化への追記(C5 と同時)

> **入力ドメイン検証(Phase 4追加)**: `validateDilutionInputs(inputs): ValidationIssue[]` を追加する。§0.2 の規約に準じ違反を全件列挙する。制約: initialCapTable の各 ownership ∈ [0,1] かつ Σ=1(誤差1e-9)、isPool は高々1件、preMoneyValuation > 0、amountRaised ≥ 0、optionPoolPostPct ∈ [0,1)、0 ≤ fundInvestment ≤ amountRaised、各ラウンドで n + optionPoolPostPct < 1(n = amountRaised/post。違反時は希釈係数 k ≤ 0 となり持分が非正化するため)、yearIndex ≥ 0 の整数、exit.yearIndex ≥ 全ラウンドの yearIndex、exit.equityValue ≥ 0。`simulateDilution` 自体は従来どおり検証を行わない(呼び出し側が事前に検証する契約)。

§3 プロパティ表への追記:

> | P16 | 希薄化 | validateDilutionInputs が空を返す入力 ⇒ 全ラウンド後の全保有者 ownership ∈ [0,1] |
> | P17 | 希薄化 | ドメイン外入力 ⇒ 該当 field の ValidationIssue が列挙される |

### 7.2 §1.5 感度分析への追記(C2 と同時。P4-1 裁定=削除で確定、削除版を採用)

> **感度対象ドライバーの選定基準(Phase 4確定)**: `driverIds` は base EV(`baseEv` が返す値)に影響し得るドライバーに限る。auxiliary(SaaS簡易DCF)や keyMetrics のみに影響するドライバーは、トルネードチャート上で恒常的に span=0 となり誤解を招くため列挙しない。これに伴い SaaS の `discountRate`/`fcfMargin`、メディアの `monthlyChurn`/`cpa`、EC/D2C の `f2Rate`/`aov` を各 SENSITIVITY_DRIVERS から削除した。
>
> **消費側契約(Phase 4追加)**: セクターID→(driverIds取得/applier/baseEv/表示ラベル)の対応はUI層のレジストリ(`src/ui/sensitivity/sensitivityRegistry.ts`)が保持する(ベンチマークのUIマッピング表と同じ配置規約)。ドライバー毎の変動幅は、呼び出し側が `buildTornado` をドライバー単位で呼び分けて実現する(`SensitivityConfig` は単一 δ のまま)。

(P4-1 裁定により削除版の採用が確定。残置版の代替注記は不要となった。)

### 7.3 §4 未確定事項表への追記

> | U-21 | 感度分析: EVに影響しないドライバーの扱い | base EVに影響するドライバーに限る(構造的span=0の6件を削除。P4-1裁定) | **確定** |
> | U-22 | 資本政策: Exit年の持ち方 | vcMethod.yearsToExit を共用(capitalPolicyに独自フィールドを持たない。P4-5裁定) | **確定** |

---

## 8. 未確定事項一覧(全7項目 裁定済み)

**2026-07-13 に全項目が裁定された**(原文: `docs/logs/phase4-rulings-20260713.md`)。すべて下表の推奨案が採用され、P4-1 のみ追加指示(SaaS/メディア/ECのUIへの注記表示、§3.1)がある。裁定結果は §9 の実装指示書に反映済み。下表は設計時の選択肢とトレードオフの記録として残す。

| # | 論点 | 推奨 | 代替案 | トレードオフ |
| --- | --- | --- | --- | --- |
| **P4-1** | 構造的 span=0 ドライバー6件(§0.1。SaaS discountRate/fcfMargin、メディア monthlyChurn/cpa、EC f2Rate/aov)の扱い | **SENSITIVITY_DRIVERS から削除**(C2)。トルネードは「EVインパクトの降順表示」(要件§4.1.5)であり、EVに影響しない項目の±20%表示はツールの意味を損なう | (a) 残置し「EVに影響しません」グループで表示 (b) SaaS のみ auxiliary(簡易DCF)に対する感度として別評価 | 削除: エンジン公開配列の変更(テスト修正小、golden不変)。残置: 実装最小だが恒常無意味行が並ぶ。(b): 「EVの感度」という単一の意味論が崩れ、UIも2軸になり複雑化 |
| **P4-2** | ドライバー毎変動幅設定の永続化 | **非永続**(セッション内state。リロードで既定±20%に戻る)。分析時の一時的な what-if 操作であり、シナリオの再現性に関わる入力(ドライバー値)と性質が異なる | (a) Scenario に保存(どうせ v3 マイグレーションを行う今回が追加の好機) (b) localStorage の UIプリファレンス(シナリオ外) | 非永続: 実装最小・スキーマ増なし、ただし毎回設定し直し。(a): 再現性は上がるが「感度設定込みのシナリオ」という概念が増え、エクスポートJSONも肥大。(b): シナリオ間で設定が混ざる |
| **P4-3** | 縮退 span=0(launchYear の丸め等)の表示 | **非表示にせず「この変動幅では感度なし」グループでラベル列挙**(§3.4) | 完全非表示(チャートから除外) | 表示: 1行分の場所を取るが「計算されていない」誤解を防ぐ。非表示: チャートは簡潔だが設定UIとの不一致が不可解 |
| **P4-4** | Exit企業価値の参照レンジ点 | **既定=ベース、セレクトで悲観/ベース/楽観を切替可**(`exitEvSource` としてシナリオに保存)。あわせて EV−netDebt ≤ 0 のとき「計算不能」警告とする扱い(§4.2)も本項で確認 | 3点並記(VC法テーブルと同様に3列で全部見せる) | 切替式: 持分推移表・IRR等の主要出力が1系列で読みやすい。3列: 一覧性はあるが持分推移×3系列は表が過大(持分推移はレンジ点に依存しないため、実際に3倍になるのは手取り・IRR/MOIC行のみ→折衷として「手取り・IRR/MOICのみ3列」も可) |
| **P4-5** | Exit年の持ち方 | **`vcMethod.yearsToExit` を共用**(capitalPolicy に独自フィールドを持たせない) | `capitalPolicy.exitYearIndex` を独立に持つ | 共用: 二重入力なし、含意IRRと期待IRRが同一Exit時点で比較可能。独立: ラウンド計画とVC法検討を別々の時間軸で弄れるが、食い違ったまま気づかないリスク |
| **P4-6** | `vcMethod.dilutionRetention` と資本政策の連動 | **Phase 4 では連動させない**。資本政策セクションに参考値(初回出資時持分→Exit実効持分の残存率)を表示するに留め、VC法への反映は手入力のまま | 「シミュレーターから反映」ボタンで dilutionRetention を上書き | 非連動: 実装小・既存VC法の挙動不変。ただし手動転記の手間。連動: 便利だが、ファンドが複数ラウンドに出資した場合の「残存率」の定義が一意でなく(どの出資分を基準にするか)、定義の裁定がさらに必要になる |
| **P4-7** | 初期資本政策の編集粒度 | **保有者リストをそのまま編集可能にする**(名前/持分%/プール/自ファンドのフラグ。エンジンの CapTableHolder と1:1) | 「創業者+既存プール%」の2入力に簡略化(創業者以外の既存株主は表現不可) | リスト編集: エンジン能力をフルに使え、既存投資家がいる実案件に対応。簡略化: UIは簡単だがシリーズB以降の検討で使えず、Phase 4 内で作り直しになる公算 |

※ audit-phase3-v2.md §4 の「要ユーザー確認」3件のうち、指摘12(不正フェーズ名)は WP-A で修正済み・B-2 は Rev.5 トリアージ節に反映済み・「裁定文書の存在想定」はセッションログ運用ルール(CLAUDE.md)の追加で解消済み。本表とは独立。

---

## 9. Sonnet 実装セッションへの指示書(ドラフト)

> Phase 4-B(実装)セッション冒頭に貼る指示書。裁定結果(2026-07-13確定、`docs/logs/phase4-rulings-20260713.md`)は反映済みであり、このまま使用できる。

---

Phase 4 の実装を行います。設計は `docs/phase4-spec.md` に確定済みです。**必ず全文を読み、§8 の裁定結果(下記)に従って実装してください。**

### 裁定結果(P4-1〜P4-7、2026-07-13確定。原文: docs/logs/phase4-rulings-20260713.md)

- **P4-1**: 削除(C2実施、engine-spec追記は§7.2削除版を採用)。追加指示: C4のUIに「マルチプル法のためユニットエコノミクス系ドライバーはEVに影響しない」旨の短い注記を表示すること
- **P4-2**: 非永続(セッション内state)
- **P4-3**: 「この変動幅では感度なし」グループでラベル列挙(非表示にしない)
- **P4-4**: 既定=ベース、悲観/ベース/楽観の切替セレクト。exitEvSource としてシナリオに保存し、v3マイグレーションのデフォルト補完値は 'base'。EV−netDebt ≤ 0 は「計算不能」警告
- **P4-5**: vcMethod.yearsToExit を共用(独自フィールドを持たない)。U-22確定
- **P4-6**: Phase 4では非連動。参考値(初回出資時持分→Exit実効持分の残存率)の表示のみ。ワンクリック反映は残存率定義の裁定とセットでバックログ化(下記「特に注意する点」7)
- **P4-7**: 保有者リスト編集(名前/持分%/プール/自ファンドフラグ、CapTableHolderと1:1)

### 実装順序とコミット

phase4-spec.md §6 の C1〜C9 の順に、1コミットずつ進めること。**最初のコミットは必ず C1(創薬 buildTornado 統合テスト。監査ゲート条件3)**。C2 は P4-1 裁定(削除)により実施が確定している。

### 各コミット共通の完了条件(CLAUDE.md DoD)

- `npm run typecheck` / `npm run lint` / `npm run test` すべて Green
- golden fixture(`src/engine/__fixtures__/`)に差分がないこと(Phase 4 は golden 再生成を伴わない)
- エンジンとUIを同一コミットに混ぜない(engine-spec の同時更新は例外的にエンジンコミットに同梱)
- 既存テストを壊さない。仕様変更に伴う期待値更新(SCENARIO_SCHEMA_VERSION=3 等)は当該コミット内で明示的に行う

### 特に注意する点

1. **エンジン純粋性**: 新規エンジンコード(validateDilutionInputs)は React/DOM/Date/乱数/ストレージに依存しないこと。レジストリ・ラベル表は UI 層(`src/ui/sensitivity/`、`src/ui/sectors/*/`)に置き、エンジンには置かない。
2. **マイグレーションなしの型拡張は禁止**(audit D-1 再発防止): C6 では型追加・バージョン繰り上げ・migrateV2ToV3・回帰テスト(多段/冪等/ラウンドトリップ/両経路)を同一コミットで完結させること。
3. **δ_r は固定値 ±0.02 のまま**(U-20確定・WP-A裁定)。可変化の再検討・DriverApplier シグネチャ変更は行わない。UI では当該ドライバーの変動幅を編集不可表示にする。
4. **スコープ外に踏み込まない**: 並列比較ビュー・ポートフォリオ(Phase 5)、判定色・円形ゲージ・単位切替等のビジュアル磨き込み(Phase 6)は実装しない。トルネード・資本政策のUIはテーマトークン参照の素朴な構造に留める。
5. 仕様にない判断が必要になったら、勝手に決めず「未確定事項」として列挙し、仮の妥当値+TODOコメントで進めること。金額計算に関わるものは必ず停止して確認を求めること。
6. 完了時、受入確認の報告を `docs/logs/` に保存してコミットすること(C9)。
7. C9 の docs コミットで、`requirements-rev5.md` のバックログ節に「資本政策シミュレーターから vcMethod.dilutionRetention へのワンクリック反映(残存率定義の裁定とセットで実施)」を登録すること(P4-6 裁定)。

---

*v1.0 — 2026-07-13。Phase 4-A 設計セッション(Fable)。コード変更なし。§8 の裁定後に Phase 4-B(実装、Sonnet)へ。*
*v1.1 — 2026-07-14。P4-1〜P4-7 の裁定(2026-07-13確定、docs/logs/phase4-rulings-20260713.md)を転記。全項目で推奨案採用、P4-1 に UI注記の追加指示。§9 指示書はこのまま使用可。*
