# CLAUDE.md — VC Valuation Simulator プロジェクト規約

このファイルは Claude Code が毎セッション参照する恒久ルール。要件の詳細は `docs/requirements-rev6.md` を正とする(旧版 rev4/rev5 は履歴として保持)。

## プロジェクト概要

VC向け企業価値シミュレーター。6セクター(SaaS/創薬/医療機器/メディアテック/EC・D2C/クライメートテック)のシナリオ別バリュエーションを行う静的Webアプリ。Stage 1 は GitHub Pages + localStorage、Stage 2 で Google Cloud(GAS/Drive)へ移行する。

## 絶対に守る設計原則

1. **計算エンジンは純粋関数**: `src/engine/` は React・DOM・ストレージ・日付・乱数に依存しない。副作用ゼロ。入力→出力のみ。テストが製品の生命線
2. **データ層はインターフェース越し**: UIとエンジンは `StorageAdapter` / `BenchmarkSource` インターフェースのみに依存。localStorage/GAS/Drive の具体実装はアダプタに隔離
3. **テーマはトークン参照のみ**: コンポーネントに `if (theme === 'dark')` を書かない。色・角丸・影・フォント・モーションを2セットのCSSトークンで定義。テーマ固有の演出のみ `src/theme-effects/` に隔離
4. **入力データはブラウザ外に出さない**: Stage 1 では外部送信一切なし。分析ツールも入力値は送らない
5. **ダミーデータは明示**: `data_status: "dummy"` のときUIに常時バッジ。実データと混同させない
6. **永続化される型の変更にはマイグレーションを必ず同伴**: Scenario 等、
   localStorage/エクスポートJSONに保存される型を変更(フィールド追加を含む)する
   場合は、同一の作業内で (a) schemaVersion の繰り上げ (b) 旧→新のマイグレーション
   (ロード/インポート両経路・冪等) (c) 旧形式 fixture による回帰テスト、の3点を
   必ず実装する。マイグレーションなしの型拡張は、テストが Green でも
   Definition of Done を満たさない(Phase 3 の D-1 事故の再発防止)

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
  requirements-rev6.md   # 要件の正。engine-spec.md(計算仕様)、phase4-spec.md(Phase 4設計)
  logs/                  # レビュー報告・監査報告・修正完了報告(セッション成果物)
```

## Definition of Done(全Phase共通)

- 変更したエンジンコードに対応するテストが存在しGreen
- `npm run typecheck` / `npm run lint` / `npm run test` がすべて通る
- 破壊的変更なし(既存テストを壊していない)
- 各Phase固有の完了条件(下記フェーズ表)を満たす

## エンジン変更の規則

- エンジンの計算仕様を変更・追加する場合、TypeScript 実装・Python リファレンス実装
  (tools/reference/)・engine-spec.md の3点を同一の作業単位で同期させる。
  どれか一つでも欠けた状態でコミットしない
- golden の再生成は、一連の関連修正がすべて完了した後に1回だけ行い、
  再生成を単独コミットにする(生成タイミングを履歴で追跡可能にするため)。
  生成レンジは spec のドメイン制約内に限定し、境界値(0・確率の0/1・上限)を
  必ず含める
- 感度分析・派生指標などエンジンの式を UI が必要とする場合、UI 側で式を
  複製せず、エンジンから純粋関数ヘルパーを export して呼ぶ

## コミット規約

Phase単位でこまめにコミット。`feat(engine): SaaS rNPV model` のようにスコープを明示。エンジンとUIは別コミットに分ける。

## 判断に迷ったら

要件書に無い仕様判断が必要になったら、勝手に決めず「未確定事項」として列挙し、実装は仮の妥当値+TODOコメントで進める。金額計算のロジックに関わる不確実性は特に必ず確認を求める。

実装中にやむを得ず仕様外の判断を行った場合は、コード内コメントだけで
済ませず、同じ作業単位で engine-spec.md / requirements への反映(または
未確定事項としての報告)まで行うこと。コード内コメントは文書化の代替に
ならない(監査で「spec片側未反映」として検出される)。

## セッション成果物の保存

レビュー報告・監査報告・裁定・修正完了報告は、セッション終了や /clear の前に docs/logs/ 配下にファイルとして保存しコミットする。コミットメッセージへの記載は保存の代替にならない。
