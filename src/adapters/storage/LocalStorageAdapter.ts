/**
 * StorageAdapter の Stage 1 実装。ブラウザの localStorage をバックエンドとする。
 * 1つの localStorage キーの下に配列としてまとめて保存する。
 *
 * migrate 関数を注入することで、ロード時(readAll、list/load から利用)・
 * インポート時(import)の両経路で永続化データのスキーマ移行を行う
 * (出典: docs/requirements-rev5.md §8、D-1裁定)。未指定時は恒等関数。
 */
import type { StorageAdapter } from './StorageAdapter.ts'

export class LocalStorageAdapter<T extends { id: string }> implements StorageAdapter<T> {
  private readonly storageKey: string
  private readonly migrate: (raw: unknown) => T

  constructor(storageKey: string, migrate: (raw: unknown) => T = (raw) => raw as T) {
    this.storageKey = storageKey
    this.migrate = migrate
  }

  private readAll(): T[] {
    const raw = window.localStorage.getItem(this.storageKey)
    if (!raw) return []
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return []
    }
    if (!Array.isArray(parsed)) return []

    const migrated: T[] = []
    for (const item of parsed) {
      try {
        migrated.push(this.migrate(item))
      } catch {
        // 破損・移行不能な1件はスキップし、他の項目のロードを継続する
        // (旧形式データでアプリ全体がクラッシュしないことを優先する)
      }
    }
    return migrated
  }

  private writeAll(items: T[]): void {
    window.localStorage.setItem(this.storageKey, JSON.stringify(items))
  }

  async list(): Promise<T[]> {
    return this.readAll()
  }

  async load(id: string): Promise<T | null> {
    return this.readAll().find((item) => item.id === id) ?? null
  }

  async save(item: T): Promise<void> {
    const items = this.readAll()
    const index = items.findIndex((existing) => existing.id === item.id)
    if (index >= 0) {
      items[index] = item
    } else {
      items.push(item)
    }
    this.writeAll(items)
  }

  async delete(id: string): Promise<void> {
    this.writeAll(this.readAll().filter((item) => item.id !== id))
  }

  async export(id: string): Promise<string> {
    const item = await this.load(id)
    if (!item) throw new Error(`item not found: ${id}`)
    return JSON.stringify(item, null, 2)
  }

  async import(json: string): Promise<T> {
    const parsed: unknown = JSON.parse(json)
    const migrated = this.migrate(parsed)
    const withNewId: T = { ...migrated, id: crypto.randomUUID() }
    await this.save(withNewId)
    return withNewId
  }
}
