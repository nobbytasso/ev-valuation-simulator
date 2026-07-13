# CLAUDE.md — VC Valuation Simulator プロジェクト規約

このファイルは Claude Code が毎セッション参照する恒久ルール。要件の詳細は `docs/requirements-rev4.md` を正とする。

## プロジェクト概要

VC向け企業価値シミュレーター。6セクター(SaaS/創薬/医療機器/メディアテック/EC・D2C/クライメートテック)のシナリオ別バリュエーションを行う静的Webアプリ。Stage 1 は GitHub Pages + localStorage、Stage 2 で Google Cloud(GAS/Drive)へ移行する。

## 絶対に守る設計原則

1. **計算エンジンは純粋関数**: `src/engine/` は React・DOM・ストレージ・日付・乱数に依存しない。副作用ゼロ。入力→出力のみ。テストが製品の生命線
2. **データ層はインターフェース越し**: UIとエンジンは `StorageAdapter` / `BenchmarkSource` インターフェースのみに依存。localStorage/GAS/Drive の具体実装はアダプタに隔離
3. **テーマはトークン参照のみ**: コンポーネントに `if (theme === 'dark')` を書かない。色・角丸・影・フォント・モーションを2セットのCSSトークンで定義。テーマ固有の演出のみ `src/theme-effects/` に隔離
4. **入力データはブラウザ外に出さない**: Stage 1 では外部送信一切なし。分析ツールも入力値は送らない
5. **ダミーデータは明示**: `data_status: "dummy"` のときUIに常時バッジ。実データと混同させない

## 技術スタック(Stage 1、変更時は要相談)

React + TypeScript + Vite / Zustand / Recharts / Framer Motion / SheetJS(xlsx) / Vitest + fast-check / Python(リファレンス実装・fixture生成のみ)

## ディレクトリ規約

```
src/
  engine/            # 純粋関数。セクター別モデル + VC法 + 希薄化。依存ゼロ
    sectors/         # saas.ts, drugDiscovery.ts, ... 各セクター
    common/          # vcMethod.ts, dilution.ts, sensitivity.ts
    __fixtures__/    # *.golden.json (Pythonが生成、手編集禁止)
    *.test.ts        # golden突合 + fast-checkプロパティ
  adapters/          # LocalStorageAdapter, StaticJsonSource (Stage2でDrive/GAS追加)
  store/             # Zustand。シナリオ/ポートフォリオ状態
  ui/                # コンポーネント。トークン参照のみ
  theme/             # tokens.dark.css, tokens.light.css, ThemeProvider
  theme-effects/     # スキャン演出・パーティクル等テーマ固有
tools/
  reference/         # Python独立実装 + golden生成スクリプト
data/
  benchmarks/        # benchmark.schema.json, benchmarks.dummy.json
docs/
  requirements-rev4.md
```

## Definition of Done(全Phase共通)

- 変更したエンジンコードに対応するテストが存在しGreen
- `npm run typecheck` / `npm run lint` / `npm run test` がすべて通る
- 破壊的変更なし(既存テストを壊していない)
- 各Phase固有の完了条件(下記フェーズ表)を満たす

## コミット規約

Phase単位でこまめにコミット。`feat(engine): SaaS rNPV model` のようにスコープを明示。エンジンとUIは別コミットに分ける。

## 判断に迷ったら

要件書に無い仕様判断が必要になったら、勝手に決めず「未確定事項」として列挙し、実装は仮の妥当値+TODOコメントで進める。金額計算のロジックに関わる不確実性は特に必ず確認を求める。
