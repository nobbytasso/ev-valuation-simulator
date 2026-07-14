/**
 * WCAG AAコントラスト回帰テスト(§8.1)。トークンCSSをパースして計算し、
 * パステル/シアンの色調整はこのテストをGreenに保ったまま行う(要件§5制約1の機械化)。
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { contrastRatioHex } from './contrast.ts'
import { parseThemeTokens } from './tokenParser.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const darkTokens = parseThemeTokens(path.join(__dirname, 'tokens.dark.css'), 'dark')
const lightTokens = parseThemeTokens(path.join(__dirname, 'tokens.light.css'), 'light')

const AA_NORMAL = 4.5
/** 大きな数値表示(EVレンジ・ゲージ中央値等の太字大サイズ)向けの緩和基準。 */
const AA_LARGE = 3.0

function get(tokens: Map<string, string>, name: string): string {
  const value = tokens.get(name)
  if (value === undefined) throw new Error(`トークンが見つからない: --${name}`)
  return value
}

describe.each([
  ['dark', darkTokens] as const,
  ['light', lightTokens] as const,
])('%s テーマ: WCAG AAコントラスト', (_themeName, tokens) => {
  it('text/bg は4.5:1以上', () => {
    expect(contrastRatioHex(get(tokens, 'color-text'), get(tokens, 'color-bg'))).toBeGreaterThanOrEqual(AA_NORMAL)
  })

  it('text-muted/bg は4.5:1以上', () => {
    expect(contrastRatioHex(get(tokens, 'color-text-muted'), get(tokens, 'color-bg'))).toBeGreaterThanOrEqual(AA_NORMAL)
  })

  it('text/surface(パネル背景) は4.5:1以上', () => {
    expect(contrastRatioHex(get(tokens, 'color-text'), get(tokens, 'color-surface'))).toBeGreaterThanOrEqual(AA_NORMAL)
  })

  it('accent-contrast/accent(バッジ・大きな数値表示) は3:1以上', () => {
    expect(contrastRatioHex(get(tokens, 'color-accent-contrast'), get(tokens, 'color-accent'))).toBeGreaterThanOrEqual(
      AA_LARGE,
    )
  })

  it.each(['color-status-good', 'color-status-caution', 'color-status-bad'])('%s/bg は4.5:1以上', (key) => {
    expect(contrastRatioHex(get(tokens, key), get(tokens, 'color-bg'))).toBeGreaterThanOrEqual(AA_NORMAL)
  })

  it('caption-color/bg は4.5:1以上', () => {
    expect(contrastRatioHex(get(tokens, 'caption-color'), get(tokens, 'color-bg'))).toBeGreaterThanOrEqual(AA_NORMAL)
  })
})
