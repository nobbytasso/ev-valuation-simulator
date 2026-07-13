// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useStableListKeys } from './useStableListKeys.ts'

describe('useStableListKeys(D-12/B-8)', () => {
  it('初期件数分のユニークなkeyを生成する', () => {
    const { result } = renderHook(() => useStableListKeys(3))
    expect(result.current.keys).toHaveLength(3)
    expect(new Set(result.current.keys).size).toBe(3)
  })

  it('push()で末尾に新しいkeyが追加される(既存keyは不変)', () => {
    const { result } = renderHook(() => useStableListKeys(2))
    const before = result.current.keys
    act(() => result.current.push())
    expect(result.current.keys).toHaveLength(3)
    expect(result.current.keys.slice(0, 2)).toEqual(before)
  })

  it('removeAt(中間index)で後続のkeyがindexではなく元のkeyのまま前に詰まる(行ズレ対策の本質)', () => {
    const { result } = renderHook(() => useStableListKeys(3))
    const [keyA, keyB, keyC] = result.current.keys
    act(() => result.current.removeAt(1)) // b(index 1)を削除
    expect(result.current.keys).toEqual([keyA, keyC])
    expect(result.current.keys).not.toContain(keyB)
  })

  describe('reset(Phase 4、phase4-spec.md §5.1)', () => {
    it('reset(count)で全キーが新規のuuidにcount件再生成される', () => {
      const { result } = renderHook(() => useStableListKeys(2))
      const before = result.current.keys
      act(() => result.current.reset(3))
      expect(result.current.keys).toHaveLength(3)
      expect(new Set(result.current.keys).size).toBe(3)
      for (const key of result.current.keys) {
        expect(before).not.toContain(key)
      }
    })

    it('reset(0)で空リストになる', () => {
      const { result } = renderHook(() => useStableListKeys(3))
      act(() => result.current.reset(0))
      expect(result.current.keys).toEqual([])
    })

    it('reset後もpush・removeAtが正常動作する', () => {
      const { result } = renderHook(() => useStableListKeys(2))
      act(() => result.current.reset(1))
      expect(result.current.keys).toHaveLength(1)

      act(() => result.current.push())
      expect(result.current.keys).toHaveLength(2)

      const [keyA, keyB] = result.current.keys
      act(() => result.current.removeAt(0))
      expect(result.current.keys).toEqual([keyB])
      expect(result.current.keys).not.toContain(keyA)
    })
  })
})
