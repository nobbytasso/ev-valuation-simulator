/**
 * StorageAdapter の Stage 1 実装。ブラウザの localStorage をバックエンドとする。
 * 1つの localStorage キーの下に配列としてまとめて保存する。
 */
import type { StorageAdapter } from './StorageAdapter.ts'

export class LocalStorageAdapter<T extends { id: string }> implements StorageAdapter<T> {
  private readonly storageKey: string

  constructor(storageKey: string) {
    this.storageKey = storageKey
  }

  private readAll(): T[] {
    const raw = window.localStorage.getItem(this.storageKey)
    if (!raw) return []
    try {
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as T[]) : []
    } catch {
      return []
    }
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
    const parsed = JSON.parse(json) as T
    const withNewId: T = { ...parsed, id: crypto.randomUUID() }
    await this.save(withNewId)
    return withNewId
  }
}
