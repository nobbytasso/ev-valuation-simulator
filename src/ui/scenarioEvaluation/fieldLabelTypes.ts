/**
 * 入力フィールドラベル表(Excel「前提条件」シート・比較ビュー用)の共通型。
 * 出典: docs/phase5-spec.md §1.2-2
 *
 * セクター毎の `src/ui/sectors/<sector>/<sector>FieldLabels.ts` がこの型でラベル表を定義する。
 * 文言は各 Form.tsx の実ラベルと一致させる(phase4-spec.md §2.2 と同じ規律)。
 */

export type FieldFormat = 'money' | 'yen' | 'ratio' | 'number' | 'text' | 'select'

export interface FieldLabelEntry {
  label: string
  format: FieldFormat
  /** 列ヘッダに明記する単位表記。無単位は空文字。*/
  unit: string
}

/**
 * 配列フィールドの展開種別。出典: docs/phase5-spec.md §1.2-2
 * - assetBlock: 創薬 assets[](品目名見出し+品目内フィールド)
 * - yearAmountTable: クライメート capexSchedule[](年・金額の2列表)
 */
export type ArrayBlockKind = 'assetBlock' | 'yearAmountTable'

export interface ArrayFieldLabels {
  kind: ArrayBlockKind
  /** 配列1要素分のフィールドラベル。キーはドット区切りパス(ネスト対応)。 */
  itemFields: Record<string, FieldLabelEntry>
}

export interface SectorFieldLabelTable {
  /** スカラー入力フィールドのラベル表。キーはドット区切りパス(ネスト含む、配列は含まない)。 */
  scalars: Record<string, FieldLabelEntry>
  /** 配列フィールド名 → 展開定義。配列を持たないセクターは空オブジェクト。 */
  arrays: Record<string, ArrayFieldLabels>
}
