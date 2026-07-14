import '@testing-library/jest-dom/vitest'

// jsdom(このツールチェーンのバージョン組み合わせ)は、環境URLを設定していても
// window.localStorage が opaque origin 扱いで undefined になることがある。
// テスト用にメモリバックエンドの Storage 互換実装で補う(本番はブラウザの実装を使う)。
function createMemoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value))
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size
    },
  }
}

if (typeof window !== 'undefined') {
  let needsPolyfill = false
  try {
    needsPolyfill = !window.localStorage
  } catch {
    needsPolyfill = true
  }
  if (needsPolyfill) {
    Object.defineProperty(window, 'localStorage', {
      value: createMemoryStorage(),
      configurable: true,
      writable: true,
    })
  }

  // jsdomはResizeObserverを実装しない。Recharts(ResponsiveContainer)が参照するため
  // テスト用にno-opポリフィルを与える(実描画サイズの検証はしない)。
  if (!window.ResizeObserver) {
    class ResizeObserverPolyfill {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    window.ResizeObserver = ResizeObserverPolyfill as unknown as typeof ResizeObserver
  }

  // jsdomはmatchMediaを実装しない。円形ゲージ(useCountUp)・theme-effectsの
  // prefers-reduced-motion判定が参照するため、既定matches:falseのno-opポリフィルを与える
  // (reduced-motion固有の挙動を検証するテストは個別にwindow.matchMediaをモックする)。
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList
  }
}
