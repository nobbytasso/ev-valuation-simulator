# 計算エンジン仕様書(engine-spec)v0.2

Phase 1 実装前の数式・型定義。`docs/requirements-rev4.md` §3・§7 を正とし、本書はそれを計算可能なレベルまで具体化したもの。**本書の「未確定事項(U-n)」は実装時に仮の妥当値+TODOコメントで進め、確定後に本書と実装を同時更新する。**

対応する実装: `src/engine/`(純粋関数、依存ゼロ)。リファレンス実装: `tools/reference/`(Python)。

---

## 0. 共通規約

### 0.1 型エイリアスと単位

```ts
/** 金額。単位: 百万円(JPY millions) */
type Money = number

/** 比率。小数表現(0.25 = 25%)。UIでの%表示はUI層の責務 */
type Ratio = number

/** 単価・顧客単位の金額。単位: 円。エンジン内で ÷ 1e6 して Money に換算 */
type Yen = number

/** 評価基準時点(t = 0)からの経過年数。整数 */
type YearIndex = number

/** 悲観/ベース/楽観の3点レンジ */
interface Range3<T> {
  pessimistic: T
  base: T
  optimistic: T
}

type EvRange = Range3<Money>
```

- **通貨**: 円建てのみ(Stage 1)。表示単位切替(百万円/億円)はUI層。
- **時間軸**: 離散・年次。キャッシュフローは**期末発生・期末割引**(期央調整なし → U-16)。
- **確率**: `Ratio`、定義域 [0, 1]。

### 0.2 エンジンの入出力規約

```ts
interface ValidationIssue {
  field: string        // 例: "discountRate"
  code: string         // 例: "OUT_OF_DOMAIN", "TERMINAL_GROWTH_GTE_DISCOUNT"
  message: string      // 日本語メッセージ
}

type EngineResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: ValidationIssue[] }

/** 全セクター共通の評価結果 */
interface SectorValuationResult {
  ev: EvRange                          // 企業価値レンジ(百万円)
  auxiliary?: Money                    // 補助評価値(SaaSの簡易DCF等)。単一値
  keyMetrics: Record<string, number>   // 自動算出指標(Rule of 40, LTV/CAC等)
  cashflows?: { t: YearIndex; cf: Money }[]  // DCF系モデルの年次CF(チャート用)
}
```

- ドメイン外入力は例外を投げず `ok: false` で返す(純粋関数・全域関数)。
- 計算不能な派生指標(例: チャーン0のLTV)は `keyMetrics` に含めず、理由をUI層が判別できるよう `NaN` ではなく**キー自体を省略**する。

### 0.3 レンジとシナリオの関係(重要)

- **レンジ(悲観/ベース/楽観)**: 1つのシナリオ(=1セットのドライバー値)の中で、**マルチプル系モデルはマルチプルの3点入力**、**DCF系モデルは割引率の3点入力**(悲観=高割引率)から機械的に生成する。
- **シナリオプリセット**(順調/鈍化/停滞 等): ドライバー一式の別セット。各シナリオがそれぞれレンジを持つ。プリセットは「ベース入力に対する部分上書き(partial override)」として定義する。プリセットの具体値 → U-17。

### 0.4 数値計算の決定性(golden突合のため)

- Python リファレンスとの相対誤差 **1e-9 以内**で一致させるため、反復解法は手順を固定する:
  - IRR は二分法。探索区間 `(-0.9999, 10.0]`、収束判定 `|f(r)| < 1e-12` または反復200回で打ち切り。
- べき乗・総和の順序は t 昇順で統一(浮動小数点の結合順序差を排除)。

---

## 1. 共通コンポーネント

### 1.1 現在価値(PV / NPV)

割引率 `r`(`Ratio`, r > -1)、キャッシュフロー列 `CF_t`(t = 0..T)に対し:

```
NPV(r, CF) = Σ_{t=0}^{T} CF_t / (1 + r)^t
```

**ターミナルバリュー(Gordon成長モデル)**: 最終予測年 T の CF と永続成長率 `g_term` に対し

```
TV_T = CF_T × (1 + g_term) / (r − g_term)      (r > g_term を要求。違反は ValidationIssue)
PV(TV) = TV_T / (1 + r)^T
```

**境界条件**: r ↑ ⇒ NPV ↓(CF ≥ 0 のとき単調減少)— fast-check プロパティ。

### 1.2 VC法(共通オーバーレイ)

```ts
interface VcMethodInputs {
  exitEnterpriseValue: Money   // Exit時企業価値(セクターモデルの出力を接続)
  netDebtAtExit: Money         // 既定 0(→ U-12)
  targetMultiple: number       // 目標倍率(> 0)。例: 10
  yearsToExit: number          // > 0
  investment: Money            // 今回投資額
  dilutionRetention: Ratio     // Exit時までの持分残存率(0,1]。希薄化シムから接続、手入力も可
}

interface VcMethodResult {
  exitEquityValue: Money           // = exitEV − netDebt
  impliedPostMoneyNow: Money       // 現在の許容ポストマネー
  impliedIrr: Ratio                // 目標倍率が含意するIRR
  requiredOwnershipAtExit: Ratio   // Exit時必要持分
  requiredOwnershipAtEntry: Ratio  // 投資時必要持分(希薄化考慮)
}
```

```
exitEquityValue         = exitEnterpriseValue − netDebtAtExit
impliedPostMoneyNow     = exitEquityValue / targetMultiple
impliedIrr              = targetMultiple^(1 / yearsToExit) − 1
requiredOwnershipAtExit = investment × targetMultiple / exitEquityValue
requiredOwnershipAtEntry = requiredOwnershipAtExit / dilutionRetention
```

**境界条件**: `requiredOwnershipAtEntry > 1` は「その条件では成立しない」として結果にフラグを立てる(エラーではない)。

### 1.3 IRR / MOIC

投資家キャッシュフロー列 `{(t_i, CF_i)}`(拠出は負、回収は正)に対し:

```
MOIC = Σ(正のCF) / Σ(負のCFの絶対値)          (割引なし)
IRR  = r  s.t.  Σ CF_i / (1 + r)^{t_i} = 0     (§0.4 の二分法)
```

- 単一投資・単一回収の場合は閉形式 `IRR = (回収額/投資額)^(1/t) − 1` を使う(二分法と同値、golden で両方検証)。
- 負のCFと正のCFの両方が存在しない場合、または区間内で符号変化がない場合、IRR は `null`(MOICのみ返す)。

### 1.4 希薄化(資本政策シミュレーター)

持株比率のみで計算する(株式数は持たない)。初期状態は保有者リストで持分合計 = 1。

```ts
interface CapTableHolder {
  id: string
  name: string
  ownership: Ratio          // 初期持分。Σ = 1(未消化オプションプールも1保有者として含む)
  isPool?: boolean          // オプションプール枠
  isFund?: boolean          // 自ファンド(IRR/MOIC集計対象)
}

interface FundingRound {
  name: string              // 例: "シリーズA"
  yearIndex: YearIndex
  preMoneyValuation: Money  // プレマネー(株式価値ベース)
  amountRaised: Money       // ラウンド総調達額
  optionPoolPostPct: Ratio  // ラウンド後の未消化プール目標比率。プレで組成(既存株主が負担)
  fundInvestment: Money     // うち自ファンド出資額(0 ≤ x ≤ amountRaised)
}

interface DilutionInputs {
  initialCapTable: CapTableHolder[]
  rounds: FundingRound[]           // yearIndex 昇順
  exit: { yearIndex: YearIndex; equityValue: Money }  // シナリオ評価結果と連動
}
```

**各ラウンドの計算**(現プール比率 `p_cur`、目標 `p_tgt = optionPoolPostPct`):

```
post = preMoneyValuation + amountRaised
n    = amountRaised / post                      // 新規投資家の取得比率
k    = (1 − n − p_tgt) / (1 − p_cur)            // 既存保有者(旧プール含む)の希釈係数
Δ    = p_tgt − p_cur × k                        // プール積み増し分

Δ < 0 のとき(既目標超過): Δ = 0, k = 1 − n    // プール積み増しなし

各既存保有者: ownership ← ownership × k
プール:       ownership ← p_cur × k + Δ
新規投資家:   n を追加(自ファンド分は fundInvestment / post)
```

**不変条件(fast-check)**: 全ラウンド後の持分総和 = 1(誤差 1e-12)。

**Exit時**: 未消化プールは**無視(失効)し、残余の保有者で按分し直す**【U-14 確定】。優先分配権(liquidation preference)は v1 では扱わない(→ U-13)。

```
p_pool         = Exit時点の未消化プール比率
Exit時実効持分 = ownership / (1 − p_pool)       // プール以外の各保有者。総和 = 1 に再正規化
ファンド手取り = ファンドのExit時実効持分 × exit.equityValue
ファンドCF列  = { (各ラウンドyear, −fundInvestment), (exitYear, +手取り) } → §1.3 で IRR/MOIC
```

**不変条件(fast-check)**: Exit時実効持分の総和 = 1、分配額の総和 = exit.equityValue(誤差 1e-12)。

### 1.5 感度分析(トルネードチャート)

```ts
interface SensitivityConfig {
  delta: Ratio               // 既定 0.20(±20%)。変更可
  driverIds: string[]        // 対象ドライバー(各セクターモデルが感度対象を宣言)
}

interface TornadoItem {
  driverId: string
  evAtLow: Money             // ドライバー × (1 − δ) 時のEV(base multiple/base割引率で評価)
  evAtHigh: Money            // ドライバー × (1 + δ) 時のEV
  span: Money                // |evAtHigh − evAtLow|
}
// 出力: TornadoItem[] を span 降順ソート
```

- 変動は**一度に1ドライバー**(one-at-a-time)、他はベース値固定。
- 変動は相対(乗算)。変動後の値がドライバーの定義域を出る場合は**定義域端にクランプ**する(例: 確率は [0,1])(→ U-15)。
- `evAtHigh < evAtLow` となるドライバー(割引率等)もそのまま返す(方向はUI側で表現)。

---

## 2. セクター別モデル

各セクター共通の記法: `g` = 成長率、`r` = 割引率、`M` = マルチプル。`M` と `r` の既定値はダミー(→ U-19)。

### 2.1 SaaS(日本市場)

**評価手法**: EV/ARR マルチプル(主)+ 簡易DCF(補助)

```ts
interface SaasInputs {
  arr: Money                       // 現在(実績)ARR。≥ 0
  arrGrowth: Ratio                 // 直近YoY成長率。> −1
  nrr: Ratio                       // 例 1.10。対比指標(→ U-3)
  grossMargin: Ratio               // [0, 1]。対比指標
  operatingMargin: Ratio           // [−1, 1]。Rule of 40 に使用
  fcfMargin: Ratio                 // [−1, 1]。DCFに使用
  grossChurn: Ratio                // 年間。[0, 1]。対比指標
  cacPaybackMonths: number         // > 0。対比指標
  arrBasis: 'current' | 'ntm'      // マルチプル適用基準。既定 'ntm'(→ U-1)
  evArrMultiple: Range3<number>    // 各値 > 0
  // 簡易DCF用
  projectionYears: number          // 既定 5
  growthDecayFactor: Ratio         // 年次成長率減衰係数。既定 0.85(仮値 → U-2)
  discountRate: Ratio              // DCF用。r > g_term
  terminalGrowth: Ratio            // 既定 0.02(仮値)
}
```

**主評価(マルチプル)**:

```
ARR_basis = arr                    (arrBasis = 'current')
          = arr × (1 + arrGrowth)  (arrBasis = 'ntm')

EV_k = ARR_basis × evArrMultiple_k        (k ∈ {pessimistic, base, optimistic})
```

**補助評価(簡易DCF、単一値)**:

```
g_t        = arrGrowth × growthDecayFactor^(t−1)        (t = 1..T)
Revenue_0  = arr
Revenue_t  = Revenue_{t−1} × (1 + g_t)
FCF_t      = Revenue_t × fcfMargin                       (マージンは一定 → U-2)
EV_dcf     = Σ_{t=1}^{T} FCF_t/(1+r)^t + TV_T/(1+r)^T   (TVは§1.1)
```

**自動算出指標**:

```
ruleOf40 = (arrGrowth + operatingMargin) × 100    [パーセントポイント]
```

**境界条件**: `arr = 0 ⇒ EV = 0`。`arrGrowth ↑ ⇒ EV_ntm ↑ かつ EV_dcf ↑`(単調・fast-check)。`r ≤ terminalGrowth` は ValidationIssue。

---

### 2.2 創薬(rNPV)

**評価手法**: パイプライン品目ごとの rNPV の総和

```ts
type Phase = 'preclinical' | 'phase1' | 'phase2' | 'phase3' | 'filing'
// フェーズ順序は上記の通り。'filing' 成功で上市

interface PipelineAsset {
  name: string
  currentPhase: Phase
  /** フェーズ別成功確率。既定値同梱(仮値 → U-18)、編集可。定義域 [0, 1] */
  phaseSuccessProbs: Record<Phase, Ratio>
  /** フェーズ別所要年数。既定値同梱。開発費の期間配分に使用 */
  phaseDurations: Record<Phase, number>
  /** フェーズ別開発費総額(そのフェーズの期間に均等配分) */
  developmentCosts: Record<Phase, Money>
  launchYear: YearIndex            // 上市年(入力ドライバー。感度対象)(→ U-5)
  peakSales: Money                 // ピーク売上。≥ 0
  yearsToPeak: number              // 上市→ピーク到達年数(線形ランプ)。≥ 1
  plateauYears: number             // ピーク維持年数。≥ 0
  declineRate: Ratio               // 特許切れ後の年次減衰。[0, 1]
  commercialization:
    | { type: 'own'; contributionMargin: Ratio }        // 自社販売: 売上×貢献利益率がCF
    | { type: 'license'
        royaltyRate: Ratio                               // 売上ロイヤリティ
        milestones: { phase: Phase | 'launch'; amount: Money }[] }  // イベント時マイルストーン
}

interface DrugDiscoveryInputs {
  assets: PipelineAsset[]
  discountRate: Range3<Ratio>      // 既定 {pess: 0.12, base: 0.11, opt: 0.10}(→ U-4)
  modelHorizonYears: number        // 上市後の評価年数。既定 15(仮値 → U-6)
}
```

**確率の定義**(品目の残フェーズ列を `p_1(現在), p_2, …, p_m` とする):

```
P_reach(p_1) = 1                               // 現フェーズには到達済み
P_reach(p_j) = Π_{i<j} phaseSuccessProbs[p_i]  // p_j に到達する確率
POS          = Π_{i=1}^{m} phaseSuccessProbs[p_i]   // 上市確率
P_reach(launch) = POS
```

**売上カーブ**(上市年 L = launchYear、`u = t − L` を上市後経過年とする):

```
S(t) = 0                                          (u < 0)
     = peakSales × (u + 1) / yearsToPeak          (0 ≤ u < yearsToPeak)
     = peakSales                                   (yearsToPeak ≤ u < yearsToPeak + plateauYears)
     = peakSales × (1 − declineRate)^(u − yearsToPeak − plateauYears + 1)   (以降、u < modelHorizonYears まで)
```

**リスク調整後CF**:

```
売上系CF(t):
  own:     S(t) × contributionMargin × POS
  license: S(t) × royaltyRate × POS
マイルストーン(イベント e、発生年 t_e):
  amount × P_reach(e)      // t_e はフェーズ完了年(現在からの累積 duration)、'launch' は L
開発費(フェーズ p、その期間の各年):
  −(developmentCosts[p] / phaseDurations[p]) × P_reach(p)

rNPV_asset = Σ_t CF_riskadj(t) / (1 + r)^t
EV_k       = Σ_assets rNPV_asset   (r = discountRate_k。悲観 = 高割引率)
```

**境界条件・プロパティ**:
- 全フェーズ確率 = 1 ⇒ rNPV = 通常NPV(要件§7のプロパティ)。
- あるフェーズの確率 = 0 ⇒ それ以降の開発費・売上・マイルストーンの寄与 = 0(手前の開発費は残る)。
- `peakSales = 0` ⇒ 売上系CF = 0(rNPVは開発費のみで負)。
- rNPV は負になり得る(そのまま返す。合計EVも負を許容し、UIで警告表示)。

---

### 2.3 医療機器

**評価手法**: 市場浸透モデル + DCF(主)。EV/売上は参考値として併記可(→ U-8)

```ts
interface MedicalDeviceInputs {
  annualProcedures: number         // 現在の年間対象手技数。≥ 0
  procedureGrowth: Ratio           // 手技数の年次成長。> −1
  deviceClass: 'I' | 'II' | 'III' | 'IV'   // 表示・診断用。計算式には不使用
  launchYear: YearIndex            // 承認+保険償還完了→販売開始年
  approvalDelayYears: number       // シナリオレバー。≥ 0。実効上市年 L = launchYear + delay
  pricePerProcedure: Yen           // 手技あたりデバイス売上(償還価格ベース)
  peakPenetration: Ratio           // 最大浸透率。[0, 1]
  yearsToPeak: number              // 浸透ランプ年数(線形 → U-7)。≥ 1
  recurringRatio: Ratio            // 総売上に占めるリカーリング比率。[0, 1)
  operatingMargin: Ratio           // 定常営業利益率(チャネルコスト込み → U-8)
  discountRate: Range3<Ratio>      // 悲観 = 高割引率
  projectionYears: number          // 既定 10
  terminalGrowth: Ratio            // 既定 0.02(仮値)
}
```

**数式**(実効上市年 `L = launchYear + approvalDelayYears`):

```
Procedures(t) = annualProcedures × (1 + procedureGrowth)^t
Pen(t)        = 0                                        (t < L)
              = min(peakPenetration,
                    peakPenetration × (t − L + 1) / yearsToPeak)   (t ≥ L)

DeviceRev(t)  = Procedures(t) × Pen(t) × pricePerProcedure / 1e6      [百万円]
TotalRev(t)   = DeviceRev(t) / (1 − recurringRatio)
                // リカーリング売上 = TotalRev × recurringRatio となる構成
FCF(t)        = TotalRev(t) × operatingMargin
EV_k          = Σ_{t=1}^{T} FCF(t)/(1+r_k)^t + TV_T/(1+r_k)^T
```

**境界条件**: `peakPenetration = 0` または `annualProcedures = 0` ⇒ EV = 0。`approvalDelayYears ↑ ⇒ EV ↓`(単調・fast-check)。`recurringRatio → 1` は ValidationIssue(発散)。

---

### 2.4 メディアテック

**評価手法**: EV/売上マルチプル + ユーザーエコノミクス(診断)

```ts
interface MediaTechInputs {
  mau: number                      // 現在MAU。≥ 0
  mauGrowth: Ratio                 // 年次成長率。> −1(獲得-解約の構造化はしない → U-9)
  growthDecayFactor: Ratio         // 既定 0.85(仮値)
  dauMauRatio: Ratio               // [0, 1]。対比指標
  arpuMonthly: { ad: Yen; paid: Yen; commerce: Yen }   // 月次ARPU構成。各 ≥ 0
  monthlyChurn: Ratio              // 月次解約率。[0, 1]。継続率カーブの代表値
  contentCostRatio: Ratio          // コンテンツ原価率。[0, 1]
  cpa: Yen                         // 顧客獲得単価。≥ 0
  evSalesMultiple: Range3<number>  // 各値 > 0
  projectionYears: number          // 売上予測表示用。既定 3
}
```

**数式**:

```
ARPU_total   = arpuMonthly.ad + arpuMonthly.paid + arpuMonthly.commerce   [円/月]
MAU(t)       = MAU(t−1) × (1 + g_t),  g_t = mauGrowth × growthDecayFactor^(t−1)
Revenue(t)   = MAU(t) × ARPU_total × 12 / 1e6                             [百万円]

EV_k = Revenue(1) × evSalesMultiple_k        // NTM売上基準
```

**ユーザーエコノミクス(keyMetrics)**:

```
avgLifetimeMonths = 1 / monthlyChurn                    (monthlyChurn > 0 のときのみ)
LTV               = ARPU_total × (1 − contentCostRatio) × avgLifetimeMonths   [円]
ltvCpaRatio       = LTV / cpa                            (cpa > 0 のときのみ)
paybackMonths     = cpa / (ARPU_total × (1 − contentCostRatio))
```

**境界条件**: `mau = 0` ⇒ EV = 0。`monthlyChurn = 0` ⇒ LTV系指標は省略(§0.2)。`mauGrowth ↑ ⇒ EV ↑`(単調)。

---

### 2.5 EC / D2C

**評価手法**: EV/売上 または EV/粗利マルチプル + ユニットエコノミクス(診断)

```ts
interface EcD2cInputs {
  annualRevenue: Money             // 年間売上(GMVでなくNet売上)。≥ 0
  revenueGrowth: Ratio             // > −1
  grossMargin: Ratio               // [0, 1]
  f2Rate: Ratio                    // F2転換率(初回→2回目購入)。[0, 1)
  aov: Yen                         // 平均注文単価。≥ 0
  purchaseFrequency: number        // 年間購入回数。≥ 0
  cac: Yen                         // ≥ 0
  adCostRatio: Ratio               // 売上比広告費。[0, 1]
  logisticsCostRatio: Ratio        // 売上比物流費。[0, 1]
  inventoryTurnover: number        // 年間在庫回転数。> 0。対比指標
  multipleBasis: 'revenue' | 'grossProfit'
  evMultiple: Range3<number>       // 各値 > 0
  maxLifetimeYears: number         // LTV計算の上限年数。既定 10(→ U-10)
}
```

**数式**:

```
Revenue_ntm = annualRevenue × (1 + revenueGrowth)
Basis_ntm   = Revenue_ntm                        (multipleBasis = 'revenue')
            = Revenue_ntm × grossMargin          (multipleBasis = 'grossProfit')
EV_k        = Basis_ntm × evMultiple_k
```

**ユニットエコノミクス(keyMetrics)**(F2転換率を年次リピート率の近似とみなす → U-10):

```
annualValue    = aov × purchaseFrequency × grossMargin              [円/年]
lifetimeYears  = min(1 / (1 − f2Rate), maxLifetimeYears)
LTV            = annualValue × lifetimeYears                        [円]
ltvCacRatio    = LTV / cac                       (cac > 0 のときのみ)
contributionMarginRatio = grossMargin − adCostRatio − logisticsCostRatio
```

**境界条件**: `annualRevenue = 0` ⇒ EV = 0。`revenueGrowth ↑ ⇒ EV ↑`(単調)。`f2Rate → 1` でも lifetimeYears は上限でキャップ(発散しない)。

---

### 2.6 クライメートテック

**評価手法**: プロジェクトDCF(CAPEX重視)+ マイルストーン(量産化)到達確率によるリスク調整

```ts
interface ClimateTechInputs {
  capexSchedule: { yearIndex: YearIndex; amount: Money }[]   // 正の値で入力
  subsidyCoverage: Ratio           // CAPEXのうち補助金で賄われる比率。[0, 1]。シナリオレバー
  massProductionYear: YearIndex    // 量産化マイルストーン年 m
  massProductionProb: Ratio        // 量産化到達確率 P。[0, 1]
  annualCapacityUnits: number      // 量産後の年間生産能力。≥ 0
  rampYears: number                // 量産開始→フル稼働の年数(線形)。≥ 1
  unitPrice: Yen                   // 販売単価
  unitCost0: Yen                   // 現在のユニットコスト
  costDeclineRate: Ratio           // ユニットコスト年次低減率。[0, 1)
  offtakeCoverage: Ratio           // オフテイク契約カバー率。[0, 1]。対比・診断+実現率に使用
  merchantRealization: Ratio       // 非オフテイク分の販売実現率。既定 1(仮値 → U-11)
  fixedOpexAnnual: Money           // 量産後の年間固定費
  carbonCreditVolume: number       // t-CO2/年(量産後)
  carbonCreditPrice: Yen           // 円/t-CO2。感度分析の主要対象
  discountRate: Range3<Ratio>      // 悲観 = 高割引率
  projectYears: number             // プロジェクト評価年数(t=0起点)。既定 20
}
```

**数式**(m = massProductionYear、P = massProductionProb):

```
Volume(t)   = 0                                             (t < m)
            = annualCapacityUnits × min(1, (t − m + 1) / rampYears)
              × (offtakeCoverage + (1 − offtakeCoverage) × merchantRealization)
UnitCost(t) = unitCost0 × (1 − costDeclineRate)^t
UnitMargin(t) = (unitPrice − UnitCost(t)) / 1e6              [百万円/unit。負も許容]

OpCF(t)     = Volume(t) × UnitMargin(t)
              + carbonCreditVolume × carbonCreditPrice / 1e6    (t ≥ m)
              − fixedOpexAnnual                                  (t ≥ m)
NetCapex(t) = capexSchedule(t) × (1 − subsidyCoverage)

リスク調整: t < m のCF(主に初期CAPEX)は確率調整なし(コミット済み)、
            t ≥ m のCF(OpCF・以降のCAPEX)は × P

EV_k = Σ_{t < m} −NetCapex(t)/(1+r_k)^t
     + P × Σ_{t ≥ m} [OpCF(t) − NetCapex(t)] /(1+r_k)^t
```

**境界条件・プロパティ**: `P = 1` ⇒ 通常のプロジェクトNPVと一致。`P ↑ ⇒ EV ↑`(t ≥ m の期待CF合計が正のとき単調増加)。`subsidyCoverage ↓ ⇒ EV ↓`(単調)。EVは負を許容(UIで警告)。ターミナルバリューなし(有限プロジェクト期間)。

---

## 3. fast-check プロパティ一覧(Phase 1 テスト対象)

| # | 対象 | 性質 |
| - | ---- | ---- |
| P1 | 共通NPV | CF ≥ 0 のとき r ↑ ⇒ NPV 単調減少 |
| P2 | SaaS | arrGrowth ↑ ⇒ EV(ntm基準)・EV_dcf 単調増加 |
| P3 | SaaS | arr = 0 ⇒ 全EV = 0 |
| P4 | 創薬 | 全フェーズ確率 = 1 ⇒ rNPV = 通常NPV(相対誤差 1e-9) |
| P5 | 創薬 | 任意フェーズ確率 ↑ ⇒ rNPV 単調非減少(売上CF ≥ 0 のとき) |
| P6 | 医療機器 | approvalDelayYears ↑ ⇒ EV 単調非増加 |
| P7 | 医療機器 | peakPenetration に対して EV 単調非減少 |
| P8 | メディア | mauGrowth ↑ ⇒ EV 単調増加 |
| P9 | EC/D2C | f2Rate ↑ ⇒ LTV 単調非減少(上限キャップ含む) |
| P10 | クライメート | massProductionProb ↑ ⇒ EV 単調(期待CF正で増加) |
| P11 | 希薄化 | 任意のラウンド列で持分総和 = 1(誤差 1e-12) |
| P12 | 希薄化 | 単一ラウンド・単一Exit の IRR 閉形式 = 二分法解 |
| P13 | VC法 | targetMultiple ↑ ⇒ impliedPostMoneyNow 単調減少 |
| P14 | 感度分析 | δ = 0 ⇒ 全 TornadoItem の span = 0 |
| P15 | 全セクター | レンジの順序: pessimistic ≤ base ≤ optimistic(入力レンジが順序整合のとき) |

境界値(要件§7): ゼロ成長、成功確率 0/1、単一ラウンド、`peakSales = 0`、`delta = 0` を golden fixture に含める。

---

## 4. 未確定事項一覧

未確定の項は「仮採用」で進め、コードに `TODO(U-n)` を付す。**確定**の項は 2026-07-13 のレビューで決定済み(TODOコメント不要)。

| # | 論点 | 採用 | 状態 |
| - | ---- | ---- | ---- |
| U-1 | SaaSマルチプルのARR基準(実績 vs NTM) | `arrBasis` 入力で切替可(既定 NTM) | **確定** |
| U-2 | SaaS DCFのFCFマージン改善パス | 一定マージン(改善パスは将来拡張) | 仮採用 |
| U-3 | NRR/チャーン/CAC回収を評価式に組み込むか | 組み込まない(ベンチマーク対比指標のみ) | 仮採用 |
| U-4 | 創薬のレンジ生成方法 | 割引率3点(12%/11%/10%) | **確定** |
| U-5 | 創薬: launchYear入力とフェーズ期間合計の不整合 | launchYear を正とし、不整合は警告表示のみ | 仮採用 |
| U-6 | 創薬の評価ホライズン | 上市後15年で打ち切り | **確定** |
| U-7 | 医療機器の浸透カーブ形状 | 線形ランプ(ロジスティックは将来拡張) | 仮採用 |
| U-8 | 医療機器: チャネルコスト・償還価格の分離 | operatingMargin に内包(償還下振れは価格レバーで表現) | 仮採用 |
| U-9 | メディア: MAU成長の構造化(獲得−解約分解) | 成長率直接入力(churnは診断のみ) | 仮採用 |
| U-10 | EC: LTVの定義(F2転換率→年次リピート率の近似、上限年数) | 近似採用、上限10年キャップ | **確定** |
| U-11 | クライメート: 非オフテイク販売分の実現率 | 1.0(割引なし)、入力で変更可 | **確定** |
| U-12 | ネットデット(EV→株式価値変換) | `netDebt` 入力、既定0 | 仮採用 |
| U-13 | 希薄化: 優先分配権(liquidation preference) | v1 スコープ外(単純按分) | 仮採用 |
| U-14 | 希薄化: Exit時の未消化プールの扱い | 未消化分は無視(失効し残余保有者で再正規化。§1.4) | **確定** |
| U-15 | 感度分析: 定義域外クランプ vs 加法変動 | 相対±20% + 定義域クランプ | 仮採用 |
| U-16 | 期央割引(mid-year convention) | 期末割引のみ | 仮採用 |
| U-17 | シナリオプリセットの具体値(全セクター) | Phase 3 で確定。仮値+TODO | 仮採用 |
| U-18 | 創薬フェーズ成功確率の既定値と出典 | 仮値同梱(出典確認は Cowork/文献レビューで) | 仮採用 |
| U-19 | マルチプル・割引率の既定値 | ダミー値。`benchmarks.dummy.json` と整合させる | 仮採用 |

---

*v0.1 — 2026-07-13。Phase 1 実装開始前のレビュー用。*
*v0.2 — 2026-07-13。レビュー反映: U-1/U-4/U-6/U-10/U-11/U-14 を確定。U-14 は「未消化プール無視(Exit時再正規化)」に変更し §1.4 を改定。*
