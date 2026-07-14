/**
 * WCAG AAコントラスト計算(純粋関数)。出典: docs/phase6-spec.md §8.1
 * 相対輝度→コントラスト比の標準式(WCAG 2.x)。トークンCSSをパースしたhex値に対して使う。
 */
export interface RgbColor {
  r: number
  g: number
  b: number
}

export function parseHexColor(hex: string): RgbColor {
  const normalized = hex.trim().replace('#', '')
  const full = normalized.length === 3 ? normalized.split('').map((c) => c + c).join('') : normalized
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`不正なhexカラー: ${hex}`)
  }
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  }
}

function channelLuminance(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

/** WCAG相対輝度(0〜1)。 */
export function relativeLuminance({ r, g, b }: RgbColor): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)
}

/** 2色間のコントラスト比([1, 21])。 */
export function contrastRatio(a: RgbColor, b: RgbColor): number {
  const l1 = relativeLuminance(a)
  const l2 = relativeLuminance(b)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/** hex文字列2つからコントラスト比を直接計算する便宜関数。 */
export function contrastRatioHex(hexA: string, hexB: string): number {
  return contrastRatio(parseHexColor(hexA), parseHexColor(hexB))
}
