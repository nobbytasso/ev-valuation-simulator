/**
 * ストレージアダプタ共通インターフェース。
 * 出典: docs/requirements-rev4.md §2「移行容易性の要」
 *
 * Stage 1: LocalStorageAdapter → Stage 2: DriveAdapter に差し替え可能なよう、
 * UI・ストアはこのインターフェースのみに依存する(localStorage/Drive SDK呼び出しは
 * アダプタ実装内に閉じる)。
 */
export interface StorageAdapter<T extends { id: string }> {
  list(): Promise<T[]>
  load(id: string): Promise<T | null>
  save(item: T): Promise<void>
  delete(id: string): Promise<void>
  /** 単一エンティティをJSON文字列として書き出す */
  export(id: string): Promise<string>
  /** JSON文字列から1件取り込み、保存した上で返す(新規IDを採番する) */
  import(json: string): Promise<T>
}
