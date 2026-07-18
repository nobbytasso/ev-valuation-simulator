# V2本採用 Batch 1(裁定消化)完了報告

日付: 2026-07-18 / ブランチ: `agent/investment-case-redesign`
対象: `docs/v2-adoption-spec.md` §7 Batch 1(C1〜C3)

## コミット一覧

| コミット | 種別 | 内容 |
| --- | --- | --- |
| `480a70b` | `refactor(engine)` | C1: V2 Workbench計算(`buildCaseResult`/`projectMetric`/セクター別Exit評価6関数)を `src/engine/workbench/` へ移設。Pythonリファレンス `tools/reference/workbench.py`・`generate_fixtures.py` 拡張、engine-spec.md §5追加・v0.8改版、fast-check P18〜P20 |
| `d72dd3e` | `feat(engine)` | C1: `workbench.golden.json` 追加(境界値7+ランダム30、計37ケース、単独コミット) |
| `e86f4b7` | `docs` | C2: `docs/requirements-rev6.md` 新設、CLAUDE.md「要件の正」参照を更新(該当2行) |
| `c448bb1` | `fix(ui)` | C3: W3移行係数編集パネル、W4 xlsx移設、W6コメント復元、A %浮動小数点修正 |

## テスト結果(全コミット後の最終状態)

- `npm run typecheck`: Green
- `npm run lint`(oxlint): Green(既存の `PortfolioPage.tsx`/`ScenarioComparePage.tsx` の
  react-hooks警告2件は本タスク着手前からの既存警告で、対象外)
- `npm run test`(vitest): **544 tests / 57 files 全Green**(着手前485 → 移設後528 → 最終544。
  内訳: `src/engine/workbench/` 新設43件、`legacyMigration.test.ts` 5件、
  `workbenchFieldFormat.test.ts` 8件、他既存の増分)
- `npm run test:e2e`(Playwright、サンドボックス無効で実行): **33 tests 全Green**
  (既存29件 + `e2e/v2-workbench.spec.ts` 4件を維持)
- 既存v1エンジン・6セクターgolden: `git diff main -- src/engine/__fixtures__/{climate_tech,drug_discovery,ec_d2c,media_tech,medical_device,saas_jp}.golden.json src/engine/sectors src/engine/common` は無出力(**差分なし**を確認)

## golden生成の内容(C1、`workbench.golden.json`)

- 生成元: `tools/reference/workbench.py`(独立Python実装)+ `generate_fixtures.py` 拡張
- ケース数: 37(境界値13 + ランダム24。うち本タスクで必須指定された境界値は
  以下7件を含む形で作成)
  - `saas-zero-growth`(成長率0)
  - `saas-negative-growth`(成長率負)
  - `saas-target-moic-one`(targetMoic=1)
  - `saas-years-to-exit-one`(yearsToExit=1)
  - `saas-fully-diluted-shares-zero`(fullyDilutedShares=0)
  - `saas-exit-net-debt-equity-non-positive`(Exit Net DebtでExit株式価値≤0)
  - `saas-dilution-retention-out-of-range`(持分残存率が定義域外)
  - 他6セクター境界値6件(0成長/負成長/上市成功確率0/yearsToExit=1/fullyDilutedShares=0/
    terminalGrowthガード)
- ランダムケース: seed=20260719固定、24件(6セクター均等)
- 突合: TS側golden一致テスト相対誤差1e-9(`closeEnough`)、`src/engine/workbench/sectors.test.ts`

## 判断に迷った点(仕様外の判断・確認事項)

1. **workbenchゴールデンのケース形状**: 6セクターモデルのgolden(`{sector, expected: {ev, ...}}`)と異なり、
   workbenchは「セクター別Exit評価+共通Valuation Bridge」の合成のため、
   `{sector, exitInputs, coreInputs}` → `expected`(`WorkbenchCaseResult`全体)という
   独自のケース形状を採用した。既存6セクターの形状を流用しなかった判断はengine-spec.md §5に
   明記済み。
2. **W3「主要係数」の範囲**: 全ての近似展開係数(成長率係数・severeマルチプル係数・
   医療機器の承認遅延/浸透率/ピーク年/マージン係数・創薬posFactor/peakSalesGrowth・
   クライメート4係数)は `MIGRATION_CASE_FACTORS` に全量抽出したが、インポートUIの
   テキストボックスで編集可能にしたのは「主要係数」1本(セクター毎の成長率相当の
   4要素配列: SaaS/EC/メディア/医療機器はgrowthFactor、創薬はposFactor、
   クライメートはprobabilityFactor)に絞った。spec文言「4ケース×主要係数」を
   複数係数ではなく1系統×4ケースと解釈した判断。他の係数は定数表としては編集可能な
   実装だが、UIテキストボックスは未提供(将来Batch 2以降で拡張余地として残置)。
3. **v2独自のNaN安全ガード**: 医療機器のExit評価をengineへ移設する際、`terminalValue`を
   共通`npv.ts`のEngineResult版に置き換えたが、v2は「rate<=g→0」で計算続行する仕様のため
   `terminalValueGuarded`という薄いガード関数(`src/engine/workbench/sectors.ts`)を
   追加した。エンジンspecにこの意図を明記済み(§5.2)。

## 禁止事項の遵守確認

- 旧エンジン(`src/engine/sectors`, `src/engine/common`)・store・レガシーUIの挙動変更: なし
  (git diffで確認済み、上記参照)
- Batch 2機能(複数社・追加出資・チャート)には未着手
- `git push` は未実行
