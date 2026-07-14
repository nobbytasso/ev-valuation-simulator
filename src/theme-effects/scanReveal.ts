/**
 * ダークのスキャン走査演出(§6.1)。トリガーはプリセット適用時+シナリオ切替時のみ
 * (P6-8裁定。キー入力毎には発火させない=要件§5制約2「操作を待たせない」)。
 * 発火ロジック自体はテーマ非依存(トリガー管理の共通フック)。視覚表現はCSS側で
 * data-theme='dark'スコープに限定し、ここではクラス名の一時付与のみを行う
 * (設計原則3: コンポーネントにテーマ分岐を書かない)。
 */
import { useEffect, useRef, useState } from 'react'

const SCAN_DURATION_MS = 600

export function useScanReveal(triggerKey: string | number): boolean {
  const [active, setActive] = useState(false)
  const prevKey = useRef(triggerKey)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      prevKey.current = triggerKey
      return undefined
    }
    if (prevKey.current === triggerKey) return undefined
    prevKey.current = triggerKey

    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return undefined

    setActive(true)
    const timer = setTimeout(() => setActive(false), SCAN_DURATION_MS)
    return () => clearTimeout(timer)
  }, [triggerKey])

  return active
}
