// @vitest-environment jsdom
/**
 * 会社コレクション化(docs/v2-adoption-spec.md §6.1)の後方互換ロード・会社CRUD・冪等性の回帰テスト。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { createDefaultWorkbench } from '../domain/sectorDefinitions.ts'
import type { WorkbenchCollection, WorkbenchState } from '../domain/types.ts'
import {
  addCompanyToCollection,
  duplicateCompanyInCollection,
  loadWorkbenchCollection,
  normalizeWorkbenchState,
  removeCompanyFromCollection,
  saveWorkbenchCollection,
  WORKBENCH_STORAGE_KEY,
} from './workbenchStorage.ts'

afterEach(() => {
  window.localStorage.clear()
})

describe('normalizeWorkbenchState', () => {
  it('adoptedCaseIdが欠落したデータをnullで補完する', () => {
    const state = createDefaultWorkbench()
    const { adoptedCaseId: _omit, ...withoutAdopted } = state
    const normalized = normalizeWorkbenchState(withoutAdopted as WorkbenchState)
    expect(normalized.adoptedCaseId).toBeNull()
  })

  it('既にadoptedCaseIdがある場合は上書きしない(冪等)', () => {
    const state = createDefaultWorkbench()
    const withAdopted: WorkbenchState = { ...state, adoptedCaseId: state.cases[1].id }
    expect(normalizeWorkbenchState(withAdopted).adoptedCaseId).toBe(state.cases[1].id)
    expect(normalizeWorkbenchState(normalizeWorkbenchState(withAdopted))).toEqual(normalizeWorkbenchState(withAdopted))
  })

  it('各ケースのfollowOnsが欠落したデータを[]で補完する(docs/v2-adoption-spec.md §6.2)', () => {
    const state = createDefaultWorkbench()
    const withoutFollowOns: WorkbenchState = {
      ...state,
      cases: state.cases.map((item) => {
        const { followOns: _omit, ...rest } = item
        return rest as typeof item
      }),
    }
    const normalized = normalizeWorkbenchState(withoutFollowOns)
    expect(normalized.cases.every((item) => Array.isArray(item.followOns) && item.followOns.length === 0)).toBe(true)
  })

  it('既にfollowOnsがある場合は上書きしない(冪等)', () => {
    const state = createDefaultWorkbench()
    const withFollowOn: WorkbenchState = {
      ...state,
      cases: state.cases.map((item, i) =>
        i === 0 ? { ...item, followOns: [{ label: 'A', yearOffset: 1, amount: 100, postMoney: 3000 }] } : item,
      ),
    }
    const normalized = normalizeWorkbenchState(withFollowOn)
    expect(normalized.cases[0].followOns).toHaveLength(1)
    expect(normalizeWorkbenchState(normalized)).toEqual(normalized)
  })
})

describe('loadWorkbenchCollection: 後方互換ロード', () => {
  it('データなしのとき既定コレクション(1社)を返す', () => {
    const collection = loadWorkbenchCollection()
    expect(Object.keys(collection.workbenches)).toHaveLength(1)
    expect(collection.workbenches[collection.activeCompanyId]).toBeDefined()
  })

  it('旧単一WorkbenchState形式(adoptedCaseIdなし)を1社のコレクションとして包む', () => {
    const legacyState = createDefaultWorkbench('saas_jp', '旧形式株式会社')
    const { adoptedCaseId: _omit, ...legacyRaw } = legacyState
    window.localStorage.setItem(WORKBENCH_STORAGE_KEY, JSON.stringify(legacyRaw))

    const collection = loadWorkbenchCollection()

    expect(Object.keys(collection.workbenches)).toHaveLength(1)
    expect(collection.activeCompanyId).toBe(legacyState.company.id)
    const wrapped = collection.workbenches[legacyState.company.id]
    expect(wrapped.company.name).toBe('旧形式株式会社')
    expect(wrapped.adoptedCaseId).toBeNull()
  })

  it('後方互換ロードは冪等(ロード→保存→再ロードで会社数が増えない)', () => {
    const legacyState = createDefaultWorkbench('saas_jp', '旧形式株式会社')
    const { adoptedCaseId: _omit, ...legacyRaw } = legacyState
    window.localStorage.setItem(WORKBENCH_STORAGE_KEY, JSON.stringify(legacyRaw))

    const first = loadWorkbenchCollection()
    saveWorkbenchCollection(first)
    const second = loadWorkbenchCollection()

    expect(Object.keys(second.workbenches)).toHaveLength(1)
    expect(second).toEqual(first)
  })

  it('壊れたデータは既定コレクションにフォールバックする', () => {
    window.localStorage.setItem(WORKBENCH_STORAGE_KEY, '{not json')
    const collection = loadWorkbenchCollection()
    expect(Object.keys(collection.workbenches)).toHaveLength(1)
  })

  it('コレクション形式のデータに含まれるWorkbenchStateもadoptedCaseId欠落を補完する', () => {
    const state = createDefaultWorkbench('saas_jp', 'コレクション会社')
    const { adoptedCaseId: _omit, ...stateWithoutAdopted } = state
    const collection = { activeCompanyId: state.company.id, workbenches: { [state.company.id]: stateWithoutAdopted } }
    window.localStorage.setItem(WORKBENCH_STORAGE_KEY, JSON.stringify(collection))

    const loaded = loadWorkbenchCollection()
    expect(loaded.workbenches[state.company.id].adoptedCaseId).toBeNull()
  })
})

describe('会社CRUD(pure functions)', () => {
  function baseCollection(): WorkbenchCollection {
    const state = createDefaultWorkbench('saas_jp', '会社A')
    return { activeCompanyId: state.company.id, workbenches: { [state.company.id]: state } }
  }

  it('addCompanyToCollection: 会社を追加しアクティブにする', () => {
    const collection = baseCollection()
    const next = addCompanyToCollection(collection, 'ec_d2c', '会社B')
    expect(Object.keys(next.workbenches)).toHaveLength(2)
    expect(next.workbenches[next.activeCompanyId].company.name).toBe('会社B')
    expect(next.workbenches[next.activeCompanyId].company.sector).toBe('ec_d2c')
  })

  it('duplicateCompanyInCollection: ケースIDを再採番しadoptedCaseIdをリセットする', () => {
    const collection = baseCollection()
    const original = collection.workbenches[collection.activeCompanyId]
    const withAdopted = {
      ...collection,
      workbenches: { ...collection.workbenches, [original.company.id]: { ...original, adoptedCaseId: original.cases[0].id } },
    }
    const next = duplicateCompanyInCollection(withAdopted, original.company.id)
    expect(Object.keys(next.workbenches)).toHaveLength(2)
    const duplicated = next.workbenches[next.activeCompanyId]
    expect(duplicated.company.id).not.toBe(original.company.id)
    expect(duplicated.company.name).toBe('会社Aのコピー')
    expect(duplicated.adoptedCaseId).toBeNull()
    expect(duplicated.cases.map((c) => c.id)).not.toEqual(original.cases.map((c) => c.id))
  })

  it('removeCompanyFromCollection: 存在する会社を削除し別会社へアクティブを切り替える', () => {
    const collection = baseCollection()
    const withSecond = addCompanyToCollection(collection, 'ec_d2c', '会社B')
    const firstId = collection.activeCompanyId
    const next = removeCompanyFromCollection(withSecond, firstId)
    expect(Object.keys(next.workbenches)).toHaveLength(1)
    expect(next.workbenches[firstId]).toBeUndefined()
  })

  it('removeCompanyFromCollection: 最後の1社は削除できず既定コレクションへ置き換わる', () => {
    const collection = baseCollection()
    const onlyId = collection.activeCompanyId
    const next = removeCompanyFromCollection(collection, onlyId)
    expect(Object.keys(next.workbenches)).toHaveLength(1)
    expect(next.workbenches[onlyId]).toBeUndefined()
  })
})
