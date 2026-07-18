# V2 本採用(Batch 1+2)実装レビュー報告書

日付: 2026-07-18 / レビュー範囲: `835c84f`(採用仕様)〜`d1a2f44`(Batch 2 完了報告)、計15コミット
方法: 独立再検証(テスト実行・diff照合・エンジン式の読解・実ブラウザプローブ)。判定基準: `docs/v2-adoption-spec.md` v1.0(裁定①〜⑥+R-V2-1〜3)

## 判定: **承認** — 全裁定・全追加開発が仕様どおり実装済み。mainへマージしデプロイする

| 検査項目 | 結果 |
| --- | --- |
| 機械的検証(本レビューで再実行) | typecheck/lint Green・vitest **597件 Green**・E2E **37本 Green**(既存29+V2 4+Batch2 4)・build成功 |
| v1エンジン・6セクターgolden | **差分なし**(git diff空。裁定①の移設はworkbench系のみ) |
| 裁定① engine移設 | ✓ `src/engine/workbench/`+Python参照(workbench.py)+golden(37+追加出資ケース、単独コミット)+P18〜P21+engine-spec v0.8 §5 |
| 裁定② 要件改訂 | ✓ requirements-rev6.md 新設+CLAUDE.md の正参照更新 |
| 裁定③ 係数編集 | ✓ MIGRATION_CASE_FACTORS 抽出+移行係数パネル(既定=従来係数、再展開ボタン)+テスト |
| 裁定④⑤⑥ | ✓ xlsx を src/ui/excel/ へ移設 / schemaVersion現状維持 / D-5・helpers コメント復元 |
| 追加A(%浮動小数点) | ✓ toDisplay を ratioToPercentInput 経由に(指摘4フィールド含むテスト)。実ブラウザで汚染値0件を確認 |
| 追加B(ポートフォリオ連動) | ✓ 複数社コレクション(旧単一形式の後方互換ロード・冪等)+adoptedCaseId+PortfolioHolding v2→v3移行(fixture回帰・両経路)+V2時価=採用ケースcurrentAllowablePostMoney×持分(R-V2-1) |
| 追加C(バーチャート+追加出資) | ✓ exitMetricケース別バー+followOns行(useStableListKeys)+前回Post比倍率表示。**エンジン式はspec §6.2と完全一致を読解確認**(e_i=amount/postMoney、Exit持分=Σe×retention、IRRは実CF列でirrBisection) |
| 追加D(CF/円チャート+クリック選択) | ✓ ケース比較列ヘッダのクリック選択(aria-pressed・トグル・「採用中」バッジ)、投資家CFバー+回収構成円チャート(R-V2-3)、ポートフォリオ側ファンドCF+時価構成円。実ブラウザで選択→チャート1→3個へ増加を確認 |
| テーマ・規約 | ✓ チャート用 `--color-chart-1..6` トークン追加(両テーマ)、直書きなし。ドロップダウン不使用(ユーザー指示遵守) |

## 実装セッションの判断メモの査定(Batch 2 完了報告記載の5件)

複製時の adoptedCaseId リセット・インポート等の同一スロット置換・ファンドCFの相対年集計・cashflows/円チャート分解の golden 対象外・チャートトークン追加 — いずれも妥当と査定(金額式の新規発明なし。円チャート分解は検証済み値の恒等分解)。

## ユーザー確認が望ましい採用済み推奨(異議があれば fix)

- **R-V2-1**: V2連動銘柄の時価 = 採用ケースの許容Post-money × 持分(単一値・未採用時はコスト評価)
- **R-V2-2**: 追加出資の「前回Post-money」初期値 = 提示Pre-money+初回投資額
- **R-V2-3**: 円チャート = 回収の構成(投下資本回収分+超過リターン/回収+元本毀損)

*本報告の承認をもって main へマージ・push(本番デプロイ)を実施する(v2-adoption-spec §8、ユーザーの本採用指示に基づく)。*
