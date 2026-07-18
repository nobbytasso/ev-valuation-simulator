# V2パッチ(Investment Case Workbench)受入レビューと適用記録

日付: 2026-07-18
対象: `ev-valuation-simulator-v2-patch.zip`(git-apply-ready.patch、22ファイル・+2777行)
適用先: ブランチ `agent/investment-case-redesign`(`53063a1` パッチ本体+`e9f3dd6` 互換修正)。**main は未変更**(mainへのマージ=push=本番デプロイのため、ユーザー判断に委ねる)

## 1. 判定: **条件付き受入** — ブランチで全検証Green。ただし本採用時の宿題6件(§4)

## 2. 検証結果(本レビューで実施。パッチ作者は依存が無い環境のため既存スイート未実行と自認)

| 項目 | 結果 |
| --- | --- |
| `git apply --check` | クリーン適用(警告: 行末空白1件のみ) |
| typecheck / lint | Green(lint既存警告4件のみ) |
| vitest | **485件 Green**(既存475+V2追加10。※下記の修正漏れ対応後) |
| E2E | **33本 Green**(既存29本を/legacy互換で維持+V2新規4本) |
| build / preview実ブラウザ | 成功。ルート=Workbench(4ケースカード)・`/#/legacy`=旧シナリオ一覧、コンソールエラー0 |
| テーマ準拠 | InvestmentWorkbenchPage.css は色直書き0・トークン参照26箇所(原則3準拠)。ダーク/ライト両対応 |
| ダミーデータバッジ | Header の常設バッジは維持(D-5。説明コメントのみ削除された) |

## 3. 検出した修正漏れ(パッチの主張との差分)

1. **`src/ui/app.e2e.test.tsx`(vitest側App E2E)2件失敗**: 「既存E2Eを壊さないルート互換修正」は Playwright 側(patch-existing-e2e.py が phase4/5 を /legacy へ書換)のみで、**vitest 側の書換が漏れていた**。`e9f3dd6` で同じ /legacy 方針に互換修正済み(3行)。
2. 上記以外の「Vitestテスト/E2E/build Green」の主張は、本レビューの実行により事実であることを確認。

## 4. 規約・仕様との不整合(本採用時の宿題。ブロッカーではないが放置不可)

| # | 指摘 | 重さ |
| --- | --- | --- |
| 1 | **計算ロジックが `src/engine/` 外**(`src/v2/domain/`)。エンジンを一切importしない独立モデルで、CLAUDE.md エンジン規則(TS+Pythonリファレンス+engine-spec の3点同期、golden、プロパティテスト)の対象外に置かれている。V2を本採用するなら、engine への移設+参照実装 or 規約側の改訂が必要 | **大** |
| 2 | **requirements-rev5 と矛盾**: 「シナリオ内に悲観/ベース/楽観」「シナリオCRUDがデフォルト画面」という要件の正が未更新(redesign-v2.md は追加されたが requirements の Rev.6 化がない)。CLAUDE.md「spec片側未反映」ルールに照らし、採否確定後に要件改訂が必須 | **大** |
| 3 | 旧シナリオ→4ケースの**近似展開係数が発明値**(例: 成長率×[1.2, 1, 0.55, 0.15]、マルチプル×0.65)。UI の notices で「近似展開・要確認」と明示されている点は良いが、係数自体の根拠はなく金額計算に関わる仮定。裁定推奨 | 中 |
| 4 | `xlsx` import が `src/ui/excel/` 外(`src/v2/ui/workbenchExcel.ts`)— Phase 5 の隔離規約違反。移設は容易 | 小 |
| 5 | `WorkbenchState.schemaVersion: 2` が旧 Scenario v3 と別系列の番号で紛らわしい(ストレージキーは別 `workbench:v2` のため実害なし) | 小 |
| 6 | Header・e2e/helpers の既存説明コメント(D-5根拠等)が削除された(機能は維持) | 小 |

## 5. 良い点(受入判断の根拠)

- 旧機能を壊さない移行構成(/legacy 併存・旧29 E2E維持・別ストレージキーで旧データ非破壊)
- 値の素性の明示(移行時の notices、warnings の非クランプ主義)は本プロジェクトの原則と整合
- テーマトークン準拠・金額単位切替対応・localStorage/JSON往復・Excel・テスト付きと、Stage 1 の作法に沿っている

## 6. 次のアクション(ユーザー判断)

1. ブランチ `agent/investment-case-redesign` を実機確認(`git switch agent/investment-case-redesign` → `npm run dev`)
2. **本採用するか**の判断 → 採用なら §4 の宿題(特に1・2)の対応方針を裁定のうえ main へマージ(push で本番デプロイされる点に注意)
3. 見送り/保留なら main は現状(Stage 1 完成形)のまま
