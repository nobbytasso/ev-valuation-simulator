/**
 * ライト(ギャルゲー風ポップ)のハート/スパークルパーティクル(§6.2)。
 * 保存成功・プリセット適用時に短時間(≤600ms・8〜12粒)発火する。
 * フック自体はテーマ非依存(トリガーロジックの共通化)。可視化はCSS側で
 * :root[data-theme='light'] にスコープし、ダークでは非表示にする(設計原則3)。
 * データ表示領域に重ねないよう、発火位置(クリック座標)を起点にportalで描画する。
 */
import { useCallback, useState } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'

interface Particle {
  id: number
  dx: number
  dy: number
  rotate: number
  symbol: string
}

interface Burst {
  id: string
  x: number
  y: number
  particles: Particle[]
}

const SYMBOLS = ['♥', '✦', '✧']
const PARTICLE_COUNT_MIN = 8
const PARTICLE_COUNT_MAX = 12
const BURST_DURATION_MS = 600

export interface ParticleBurst {
  /** クリック等のイベント座標を起点に発火する。reduced-motion時は何もしない。 */
  trigger: (clientX: number, clientY: number) => void
  /** document.bodyへportalするノード。呼び出し側コンポーネントのJSX末尾でレンダーする。 */
  portal: React.ReactNode
}

export function useParticleBurst(): ParticleBurst {
  const [bursts, setBursts] = useState<Burst[]>([])

  const trigger = useCallback((clientX: number, clientY: number) => {
    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    const count = PARTICLE_COUNT_MIN + Math.floor(Math.random() * (PARTICLE_COUNT_MAX - PARTICLE_COUNT_MIN + 1))
    const particles: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      dx: (Math.random() - 0.5) * 90,
      dy: -40 - Math.random() * 70,
      rotate: (Math.random() - 0.5) * 90,
      symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
    }))
    const burstId = `${Date.now()}-${Math.random()}`
    setBursts((prev) => [...prev, { id: burstId, x: clientX, y: clientY, particles }])
    setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b.id !== burstId))
    }, BURST_DURATION_MS)
  }, [])

  const portal =
    typeof document !== 'undefined'
      ? createPortal(
          <div className="particle-burst-layer" aria-hidden="true">
            {bursts.map((burst) => (
              <div key={burst.id} className="particle-burst" style={{ left: burst.x, top: burst.y }}>
                {burst.particles.map((p) => (
                  <span
                    key={p.id}
                    className="particle-burst__item"
                    style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--rotate': `${p.rotate}deg` } as CSSProperties}
                  >
                    {p.symbol}
                  </span>
                ))}
              </div>
            ))}
          </div>,
          document.body,
        )
      : null

  return { trigger, portal }
}
