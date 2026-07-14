/**
 * トークンCSS(tokens.dark.css/tokens.light.css)のパース(純粋関数)。出典: docs/phase6-spec.md §8.1
 * var(--x)参照は再帰的に解決し、最終的なリテラル値(hex等)のマップを返す。
 */
import { readFileSync } from 'node:fs'

export function parseThemeTokens(cssFilePath: string, theme: 'dark' | 'light'): Map<string, string> {
  const css = readFileSync(cssFilePath, 'utf-8')
  const blockRegex = new RegExp(`:root\\[data-theme=['"]${theme}['"]\\]\\s*{([\\s\\S]*?)\\n}`, 'm')
  const match = blockRegex.exec(css)
  if (!match) throw new Error(`テーマブロックが見つからない: ${theme} (${cssFilePath})`)
  const body = match[1]

  const declRegex = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g
  const raw = new Map<string, string>()
  let m: RegExpExecArray | null
  while ((m = declRegex.exec(body))) {
    raw.set(m[1], m[2].trim())
  }

  const resolved = new Map<string, string>()
  function resolve(name: string, seen: Set<string>): string {
    const cached = resolved.get(name)
    if (cached !== undefined) return cached
    if (seen.has(name)) throw new Error(`トークンの循環参照: --${name}`)
    seen.add(name)
    const value = raw.get(name)
    if (value === undefined) throw new Error(`未定義のトークン: --${name}`)
    const varMatch = /^var\(--([a-zA-Z0-9-]+)\)$/.exec(value)
    const result = varMatch ? resolve(varMatch[1], seen) : value
    resolved.set(name, result)
    return result
  }
  for (const name of raw.keys()) resolve(name, new Set())
  return resolved
}
