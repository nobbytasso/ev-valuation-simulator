# WP-A: 監査報告書指摘の消込(完了報告)

日付: 2026-07-13
対象: `docs/audit-phase3-v2.md` §3(二次影響・文書不整合)指摘6〜12、§1 B-2、§4ゲート条件1

## 対応した指摘番号

| 指摘 | 内容 | 対応 |
| --- | --- | --- |
| 6 | 「残フェーズのみ」判断が engine-spec 片側未反映 | engine-spec §1.5.1 の driverId 一覧に追記 |
| 7 | 「実装は Phase 4」の記述が古い(D-6でPhase 3末に実装済み) | 「Phase 3 末に実装済み(コミット 80bbc97)」に更新 |
| 8 | U-20(δ_r)の「変更可」が未実装(Stage 1は固定値実装) | §1.5.1本文+§4のU-20表エントリの両方を確定裁定に更新(状態を仮採用→確定) |
| 9 | engine-spec 冒頭が rev4 参照のまま | rev5 参照に修正 |
| 10 | UIマッピング表6ファイルのヘッダコメントが v1.1 参照のまま | 6ファイル全てコメント行のみ v1.2 に修正 |
| 11 | 医療機器・クライメートの golden にキー集合比較がない(将来のimplied multiple追加時の潜在ギャップ) | requirements-rev5.md のバックログ節に、実装時のキー集合比較必須化を注記 |
| 12 | applyDrugDiscoveryDriver が不正フェーズ名でNaNキー混入 | PHASE_ORDER 照合を追加し、不明driverIdと同じ「同一参照を返す」挙動に統一。テスト1件追加 |
| B-2 (§1) | keyMetrics表示粒度不統一のトリアージ漏れ | requirements-rev5.md の低優先レビュー指摘トリアージ節に追加(Phase 6吸収、paybackMonthsは最優先) |
| ゲート条件1 (§4) | Phase 4着手前に engine-spec §1.5.1 を修正 | 指摘6〜8の対応と同一(上記) |

## 判断メモ(指示の解釈で補足したもの)

- 指摘8「U-20の『変更可』を置換」は §1.5.1 本文だけでなく §4 の U-20 テーブル行(同一事実の重複記載)にも同内容の「変更可」があったため、内部矛盾を避けるため両方を更新した。あわせて「状態」列を仮採用→**確定**に変更(固定値実装という決定自体が確定裁定であるため、他のU-n確定項目と表記を揃えた)。

## コミット

| # | ハッシュ | 内容 |
| --- | --- | --- |
| 1 | `54bbcba` | docs: resolve audit findings 6-11, B-2 triage, session-log rule(文書のみ、9ファイル) |
| 2 | `9e02f1c` | fix(engine): reject unknown phase names in drug discovery driver applier(コードのみ、2ファイル) |
| 3 | (本コミット) | docs: 本完了報告の保存 + `.gitignore` の `logs` パターンを `/logs` に限定(下記) |

## 付随対応: .gitignore のブロッキング問題

CLAUDE.md に追加したセッション成果物保存ルール(docs/logs/への保存)を実行しようとしたところ、`.gitignore` の汎用パターン `logs`(ビルド/npmログ想定)が `docs/logs/` にもマッチし、追跡できなかった。`.gitignore` の変更は本作業の指摘番号に対応しないためユーザーに確認し、`logs` → `/logs`(リポジトリ直下のみ対象)に絞る対応を承認のうえ実施した。

## テスト結果

- `npm run typecheck`: Green
- `npm run lint`: Green
- `npm run test`: **285 passed**(27ファイル。監査時点の284件+指摘12のテスト1件)
- golden fixture(`src/engine/__fixtures__/`): 差分なし(確認済み)

## スコープ外として着手しなかったもの(指示どおり)

- ゲート条件2(感度分析の消費側契約レジストリ)・条件3(創薬のbuildTornado統合テスト): Phase 4側のタスクのため未着手
- `useStableListKeys` への `reset()` 追加: Phase 4-A 設計セッションでの仕様化待ち
