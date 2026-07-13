// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { LocalStorageAdapter } from './LocalStorageAdapter.ts'

interface Item {
  id: string
  name: string
}

const KEY = 'test:items:v1'

beforeEach(() => {
  window.localStorage.clear()
})

describe('LocalStorageAdapter', () => {
  it('list/save/load/delete の基本CRUD', async () => {
    const adapter = new LocalStorageAdapter<Item>(KEY)
    expect(await adapter.list()).toEqual([])

    await adapter.save({ id: '1', name: 'A' })
    await adapter.save({ id: '2', name: 'B' })
    expect(await adapter.list()).toHaveLength(2)
    expect(await adapter.load('1')).toEqual({ id: '1', name: 'A' })
    expect(await adapter.load('missing')).toBeNull()

    await adapter.save({ id: '1', name: 'A-更新' })
    expect(await adapter.load('1')).toEqual({ id: '1', name: 'A-更新' })
    expect(await adapter.list()).toHaveLength(2)

    await adapter.delete('1')
    expect(await adapter.list()).toHaveLength(1)
  })

  it('export/import で新規IDを採番して複製する', async () => {
    const adapter = new LocalStorageAdapter<Item>(KEY)
    await adapter.save({ id: 'orig', name: 'エクスポート対象' })

    const json = await adapter.export('orig')
    const imported = await adapter.import(json)

    expect(imported.id).not.toBe('orig')
    expect(imported.name).toBe('エクスポート対象')
    expect(await adapter.list()).toHaveLength(2)
  })

  it('別インスタンス(同一キー)から永続化されたデータを読み直せる', async () => {
    const adapter1 = new LocalStorageAdapter<Item>(KEY)
    await adapter1.save({ id: '1', name: 'A' })

    const adapter2 = new LocalStorageAdapter<Item>(KEY)
    expect(await adapter2.list()).toEqual([{ id: '1', name: 'A' }])
  })
})
