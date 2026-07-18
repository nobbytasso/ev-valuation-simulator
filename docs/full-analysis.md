# EV Valuation Simulator 全体分析・再設計方針

対象リポジトリ: `nobbytasso/ev-valuation-simulator`

## 1. 結論

**全面廃棄は不要です。UIデザイン、技術基盤、純粋計算関数の多くは流用できます。  
一方、Scenarioの意味、時間軸、評価結果型、VC法との接続は再設計した方がよいです。**

現行アプリの違和感の主因は次の3点です。

1. 1つの保存シナリオの中に、さらに悲観・ベース・楽観の3点レンジがある
2. 現在価値、NTM価値、Exit時価値が同じ `ev` として扱われている
3. 事業シナリオ、評価マルチプル、要求リターン、資本政策が1本の投資ケースとして連結されていない

---

## 2. 現行アーキテクチャ

```text
React / TypeScript / Vite
├─ src/engine/          依存ゼロの純粋計算エンジン
├─ src/store/           Zustand、Scenario、Migration
├─ src/adapters/        LocalStorage、Benchmark
├─ src/ui/              セクター別フォーム、結果、比較、Excel
├─ src/theme/           ダーク・ライトテーマ
└─ src/theme-effects/   FUI・ポップ演出
```

### 良い点

- 計算エンジンがUI・ストレージから分離
- TypeScript型が比較的明確
- localStorageのスキーマ移行機構あり
- セクター別ロジックが分離
- golden fixture、プロパティテスト、E2Eあり
- テーマ、ゲージ、チャート、ベンチマーク、Excel出力が部品化
- StorageAdapter / BenchmarkSourceが抽象化

したがって、ゼロから新規開発するより、既存基盤上に新しいドメインモデルを載せる方が合理的です。

---

## 3. シナリオが二重構造になっている

現行 `Scenario` は概ね次の形です。

```ts
Scenario {
  sector
  inputs
  vcMethod
  capitalPolicy
}
```

その `inputs` の中に、さらに以下があります。

```ts
evMultiple: {
  pessimistic
  base
  optimistic
}
```

または、

```ts
discountRate: {
  pessimistic
  base
  optimistic
}
```

つまり、

```text
保存シナリオA
├─ 悲観
├─ ベース
└─ 楽観

保存シナリオB
├─ 悲観
├─ ベース
└─ 楽観
```

となっています。

投資実務で欲しいのは、通常は次のような横並びです。

```text
会社計画
引受ケース
Downside
Severe Downside
```

各列が1本の整合した投資ストーリーであり、売上・KPI、Exit時KPI、Exitマルチプル、Exit EV、現在価値、理論株価、投資家リターンが一直線につながる方が扱いやすいです。

---

## 4. 最重要問題: 時間軸が統一されていない

### SaaS

現行の主評価は、

```text
Current ARR または NTM ARR × EV/ARR Multiple
```

です。

しかしこの値をVC法で `exitEnterpriseValue` として扱い、5年後のExit価値として現在へ戻しています。

本来は、

```text
現在ARR
→ 5年間のARR推移
→ Exit Year ARR
→ Exit Multiple
→ Exit EV
→ VC法
```

です。

### EC/D2C

現行は、

```text
NTM Revenue または NTM Gross Profit × Multiple
```

です。

これもExit年の値ではないため、VC法へ接続するならExit年まで売上を推計する必要があります。

### Media Tech

MAUは複数年推計しますが、EVは1年目売上にマルチプルを掛けています。`projectionYears` がExit Year Revenueへ接続されていません。

### 医療機器

将来CFを割り引いた現在DCF価値です。これを再度Exit EVとしてVC法に入れると、時間価値の意味が二重になります。

### 創薬

rNPVは成功確率と割引率を織り込んだ現在価値です。通常、これを5年後Exit EVとして再度割り戻すべきではありません。

### Climate Tech

プロジェクトDCFによるt=0現在価値です。Exit EVとは別概念です。

### 改善案

評価結果に価値時点を持たせます。

```ts
type ValuationTiming = 'current' | 'ntm' | 'exit'
```

さらに、

```ts
valuationDate
valuationMethod
enterpriseValue
equityValue
```

を明示します。

---

## 5. 「悲観・ベース・楽観」の意味もセクターごとに違う

### マルチプル型

- SaaS
- EC/D2C
- Media Tech

主にマルチプルレンジです。

### DCF・rNPV型

- 医療機器
- 創薬
- Climate Tech

主に割引率レンジです。

同じ `EvRange` でも不確実性の意味が違います。

改善後は、シナリオを単一ケースにし、マルチプル・割引率レンジは `SensitivitySet` や `ValuationRange` として別管理するのが自然です。

---

## 6. プリセットが会社データを上書きする

現行SaaSプリセットは、成長率やマルチプルだけでなくARR自体も固定値へ置き換えます。

これはシナリオ変更というより、別のダミー会社への置換に近いです。

### 改善案

維持する項目:

- 現在ARR・売上・MAU
- 現在のCap Table
- 発行済株式数
- 現在Net Debt

変更する項目:

- 成長率
- マージン改善
- 承認遅延
- 浸透率
- Exit Multiple
- Exit Year

プリセットは全入力値ではなく差分パッチにします。

```ts
ScenarioTemplate {
  id
  label
  patches
  rationale
}
```

---

## 7. EVに効く入力と診断用入力が混在している

### SaaS

EVに直接効く:

- ARR
- ARR成長率
- ARR基準
- EV/ARRマルチプル

診断中心:

- NRR
- Gross Margin
- Gross Churn
- CAC Payback
- Operating Margin
- FCF Marginは補助DCFのみ

### EC/D2C

EVに直接効く:

- 売上
- 成長率
- 粗利率
- マルチプル

診断中心:

- F2転換率
- AOV
- 購入頻度
- CAC
- 広告費率
- 物流費率
- 在庫回転

### Media Tech

EVに直接効く:

- MAU
- MAU成長率
- ARPU
- マルチプル

診断中心:

- Churn
- CPA
- Content Cost Ratio
- DAU/MAU

フォームを次の3区分に分けるべきです。

```text
A. 会社の現在値
B. Valuationを動かす主要ドライバー
C. 診断・ベンチマークKPI
```

---

## 8. VC法で追加したいブリッジ

現行出力:

- Exit Equity Value
- 現在の許容Post-money
- Exit時必要持分
- 投資時必要持分
- 含意IRR

追加したい流れ:

```text
Exit EV
－ Exit Net Debt
＝ Exit Equity Value
÷ Required MOIC
＝ Current Post-money
－ Investment
＝ Current Pre-money
÷ Fully Diluted Shares
＝ Current Theoretical Share Price
```

追加入力:

- Fully Diluted Shares
- Current / Exit Net Debt
- Proposed Price per Share
- Pre-money / Post-money表示区分

追加出力:

- Current Pre-money
- Current Post-money
- Current Theoretical Share Price
- Implied Investment Price
- Premium / Discount vs Proposed Price

---

## 9. 推奨する新ドメインモデル

### Company

```ts
interface Company {
  id: string
  name: string
  sector: SectorId
  valuationDate: string
  currentFacts: SectorCurrentFacts
  fullyDilutedShares?: number
  currentNetDebt?: number
}
```

### CaseSet

```ts
interface CaseSet {
  id: string
  companyId: string
  cases: InvestmentCase[]
}
```

### InvestmentCase

```ts
interface InvestmentCase {
  id: string
  name: string

  operatingAssumptions: SectorOperatingAssumptions

  exitAssumptions: {
    yearsToExit: number
    exitRoute: 'ipo' | 'ma'
    valuationMethod: string
    exitMultiple?: number
    exitNetDebt: number
  }

  returnRequirements: {
    targetMoic?: number
    targetIrr?: number
    investmentAmount: number
  }

  capitalPolicy: ScenarioCapitalPolicyInputs
}
```

### CaseResult

```ts
interface CaseResult {
  operatingProjection: YearProjection[]
  exitMetric: number
  exitEnterpriseValue: number
  exitEquityValue: number
  currentAllowablePostMoney: number
  currentAllowablePreMoney: number
  theoreticalSharePrice?: number
  requiredEntryOwnership: number
  expectedFundIrr?: number
  expectedFundMoic?: number
}
```

---

## 10. セクター別の新しい扱い

### SaaS

```text
Current ARR
→ ARR Projection to Exit
→ Exit ARR
× Exit EV/ARR
→ Exit EV
```

### EC/D2C

```text
Current Revenue
→ Revenue Projection to Exit
→ Exit Revenue / Gross Profit
× Exit Multiple
→ Exit EV
```

### Media Tech

```text
Current MAU
→ Exit MAU
× Exit ARPU
→ Exit Revenue
× Exit EV/Sales
→ Exit EV
```

### 医療機器

次の2つを分けます。

```text
A. Current Intrinsic Value
   市場浸透DCFによる現在価値

B. VC Return Case
   Exit年の売上・EBITDA・Exit Multipleによる将来価値
```

### 創薬

基本表示はCurrent rNPVです。

投資家リターン分析は、次のマイルストーン、導出、M&A、IPOなどの将来イベント価値を別途定義します。

### Climate Tech

基本表示はCurrent Project NPVです。

Exit分析では、量産到達時、COD、EBITDA、プロジェクト価値、取引マルチプル等を別モデルにします。

---

## 11. 画面構成案

### 上段: シナリオマトリクス

| 項目 | 会社計画 | 引受ケース | Downside | Severe Downside |
|---|---:|---:|---:|---:|
| Exit Year | | | | |
| Exit KPI | | | | |
| Exit Multiple | | | | |
| Exit EV | | | | |
| Exit Net Debt | | | | |
| Exit Equity Value | | | | |
| Required MOIC | | | | |
| Current Post-money | | | | |
| Current Pre-money | | | | |
| Theoretical Price | | | | |
| Expected IRR | | | | |
| Expected MOIC | | | | |

### 下段: ドリルダウン

- 事業計画
- Valuation前提
- 資本政策
- 感度分析
- ベンチマーク
- キャッシュフロー
- Excel出力

現行のFUI・ライトテーマ、パネル、ゲージ、チャートは流用できます。

---

## 12. 流用範囲

### ほぼそのまま流用

- ダーク・ライトのテーマトークン
- Layout / Header
- SectionHeading
- CircularGauge
- Benchmark表示
- CashflowChart
- Rechartsグラフ
- Framer Motion演出
- StorageAdapter
- BenchmarkSource
- LocalStorageAdapter
- 希薄化計算
- NPV / IRR / MOIC共通関数
- Validation関数
- テスト基盤
- GitHub Pages / CI

### 部分流用

- セクター別Form
- SensitivitySection
- CapitalPolicySection
- Excel書式
- Portfolio
- Preset UI

### 再設計

- `Scenario` 型
- `SectorValuationResult`
- `EvRange`
- ScenarioList / Compareの意味
- VcMethodSection
- EvRangeResult
- セクター別プリセット
- SaaS / EC / MediaのExit計算
- DCF/rNPVとVC法の接続
- Excelのシート構造
- 永続化Migration

---

## 13. 改修規模

### 見た目

**70〜85%程度流用可能。**

### ドメイン・ロジック

**40〜60%程度は変更または再配線が必要。**

### 計算エンジン

- NPV、IRR、MOIC、希薄化: 高い再利用性
- 医療機器、創薬、Climateの現在価値計算: 高い再利用性
- SaaS、EC、Media: Exit年投影機能の追加が必要
- 全セクター共通の `EvRange`: 再設計推奨

---

## 14. 推奨実装順序

### Phase A: 新設計書

- 価値時点
- Company / CaseSet / InvestmentCase
- 現在価値とExit価値
- Migration方針

### Phase B: 共通Valuation Bridge

```text
Exit KPI
→ Exit EV
→ Exit Equity Value
→ Current Post-money
→ Current Pre-money
→ Theoretical Share Price
```

### Phase C: SaaSのみ新設計

4ケース比較、Exit ARR、VC法、理論株価、資本政策まで完成させてUXを検証します。

### Phase D: EC/D2C・Media

SaaSと同じExitマルチプル方式へ移行します。

### Phase E: 医療機器・創薬・Climate

Current Intrinsic ValueとExit / Return Caseを分離します。

### Phase F: 比較・Excel・Portfolio

新ケースモデルへ接続します。

### Phase G: Migration・E2E・旧画面廃止

---

## 15. 旧データ移行案

```text
旧Scenario
→ 新Company 1件
→ CaseSet 1件
→ InvestmentCase 1件
```

旧悲観・ベース・楽観は、ValuationSensitivityとして保持するか、3ケースへ展開します。

プリセット適用済み入力が会社固有値かダミー値かは判別しにくいため、移行後に「要確認」フラグを付けるのが安全です。

---

## 16. 最終提言

優先順位:

1. 時間軸
2. シナリオ単位
3. Exit価値と現在価値の区分
4. VC法の理論株価ブリッジ
5. プリセットの差分化
6. 主要ドライバーと診断KPIの区分
7. 比較・Excel・Portfolioの再接続

現行コードは品質が低いから作り直すのではありません。最初の要件が「セクター別評価ダッシュボード」を中心としており、実際に使いたい「同一会社の投資ケース比較」と主語がずれているのが本質です。

**技術基盤とデザインを残し、投資実務の思考順序に合わせてドメイン層を入れ替えるのが最適です。**
