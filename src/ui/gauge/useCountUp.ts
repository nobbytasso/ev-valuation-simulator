/**
 * 数値のカウントアップ(両テーマ共通モーション、初回のみ)。出典: docs/phase6-spec.md §4.1
 * prefers-reduced-motionを尊重し、2回目以降の値変化はアニメなしで即時反映する
 * (要件§5制約2「アニメーションは初回のみ/短時間、操作を待たせない」)。
 */
import { useEffect, useRef, useState } from 'react'
import { animate } from 'framer-motion'

export function useCountUp(target: number, durationMs = 600): number {
  const [display, setDisplay] = useState(target)
  const hasAnimated = useRef(false)
  const prevTarget = useRef(target)

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!hasAnimated.current && !prefersReducedMotion) {
      hasAnimated.current = true
      prevTarget.current = target
      const controls = animate(0, target, {
        duration: durationMs / 1000,
        onUpdate: (v) => setDisplay(v),
      })
      return () => controls.stop()
    }

    hasAnimated.current = true
    if (prevTarget.current !== target) {
      prevTarget.current = target
      setDisplay(target)
    }
    return undefined
  }, [target, durationMs])

  return display
}
