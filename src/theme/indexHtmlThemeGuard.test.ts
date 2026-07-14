// @vitest-environment jsdom
/**
 * index.html の FOUC 対策インラインスクリプト(#theme-fouc-guard)の回帰テスト。
 * 出典: docs/logs/phase4-verification-assessment-20260714.md §2・§4タスク1
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { THEME_STORAGE_KEY } from './themeContext.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function extractFoucGuardScript(): string {
  const html = readFileSync(path.join(__dirname, '../../index.html'), 'utf-8')
  const match = /<script id="theme-fouc-guard">([\s\S]*?)<\/script>/.exec(html)
  if (!match) throw new Error('index.html: id="theme-fouc-guard" のスクリプトが見つからない')
  return match[1]
}

describe('index.html: 初回描画のテーマ適用フラッシュ(FOUC)ガード', () => {
  const scriptSource = extractFoucGuardScript()

  it('themeContextのTHEME_STORAGE_KEYと同じキー文字列を参照している(リテラル二重定義のズレ防止)', () => {
    expect(scriptSource).toContain(THEME_STORAGE_KEY)
  })

  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
    window.localStorage.clear()
  })

  it('保存テーマがlightのとき、描画前にdata-theme=lightを設定する', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    new Function(scriptSource)()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('保存テーマがdarkのとき、data-theme=darkを設定する', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    new Function(scriptSource)()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('未保存のとき、ThemeProviderの既定と同じdarkにフォールバックする', () => {
    new Function(scriptSource)()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('不正な値が保存されている場合も、ThemeProvider.readStoredThemeと同じ規約でdarkにフォールバックする', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'invalid-value')
    new Function(scriptSource)()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
