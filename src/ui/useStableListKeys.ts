import { useState } from 'react'

export interface ListItemKeys {
  keys: string[]
  /** 末尾に1件追加した直後に呼ぶ(addハンドラ内でonChangeと対にして呼ぶ)。 */
  push: () => void
  /** index番目を削除した直後に呼ぶ(removeハンドラ内でonChangeと対にして呼ぶ)。 */
  removeAt: (index: number) => void
  /**
   * 行配列をadd/remove以外の経路で丸ごと差し替えた直後に、差し替えを行った側
   * (フックの所有コンポーネント)が呼ぶ(phase4-spec.md §5.1)。全キーを新規uuidで
   * count件再生成する。呼び忘れても`keys[i] ?? String(i)`のフォールバックにより
   * 安全(キー重複・例外は起きない。劣化ははみ出した行の再マウントに限られる)。
   */
  reset: (count: number) => void
}

/**
 * 編集可能リストのReact keyをindexではなく生成時に割り当てたuuidで安定させる
 * (B-8/D-12: key={index}は中間行削除時に後続行がindexを再利用しフォーム状態が
 * 行ズレする既知のアンチパターン)。
 *
 * 対象の配列(inputs.assets等)はオブジェクトの中身が編集のたびに複製される
 * (フィールド編集は `{...item, field: value}` で新しいオブジェクト参照になる)ため、
 * オブジェクト参照ベースのkey割り当てはフィールド編集のたびにkeyが変わり
 * 入力中のフォーカスが失われてしまう。そのためkeyはこのフックが独立管理する状態
 * (追加/削除操作にのみ連動し、フィールド編集では変化しない)として持つ。
 *
 * 呼び出し側は add/remove ハンドラで push()/removeAt() をonChangeと対にして呼ぶこと。
 * シナリオ切替やプリセット一括適用でリスト件数が食い違った場合は、はみ出した行に
 * フォールバックでindexを使う(呼び出し側でkeys[i] ?? String(i)のように参照する)。
 */
export function useStableListKeys(initialCount: number): ListItemKeys {
  const [keys, setKeys] = useState<string[]>(() => Array.from({ length: initialCount }, () => crypto.randomUUID()))
  const push = () => setKeys((prev) => [...prev, crypto.randomUUID()])
  const removeAt = (index: number) => setKeys((prev) => prev.filter((_, i) => i !== index))
  const reset = (count: number) => setKeys(Array.from({ length: count }, () => crypto.randomUUID()))
  return { keys, push, removeAt, reset }
}
