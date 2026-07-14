/**
 * index.htmlのGoogle Fonts CDN読込(preconnect+css2 API)の回帰テスト。
 * 出典: docs/phase6-spec.md §2、docs/logs/phase6-rulings-20260714.md P6-3
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function readIndexHtml(): string {
  return readFileSync(path.join(__dirname, '../../index.html'), 'utf-8')
}

describe('index.html: Google Fonts CDN読込(P6-3裁定)', () => {
  const html = readIndexHtml()

  it('fonts.googleapisとfonts.gstaticへpreconnectする(gstaticはcrossorigin付き)', () => {
    expect(html).toContain('<link rel="preconnect" href="https://fonts.googleapis.com" />')
    expect(html).toContain('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />')
  })

  it('css2 APIでdisplay=swapを指定する(FOUT最小化)', () => {
    expect(html).toMatch(/https:\/\/fonts\.googleapis\.com\/css2\?[^"]*display=swap/)
  })

  it('ダーク用(Inter・JetBrains Mono)・ライト用(M PLUS Rounded 1c)を各2ウェイト(400;700)で読み込む', () => {
    expect(html).toMatch(/family=Inter:wght@400;700/)
    expect(html).toMatch(/family=JetBrains\+Mono:wght@400;700/)
    expect(html).toMatch(/family=M\+PLUS\+Rounded\+1c:wght@400;700/)
  })

  it('npm依存の追加なし(package.jsonにfontsource等のWebフォントパッケージを含まない)', () => {
    const pkg = JSON.parse(readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
    const fontPackages = Object.keys(allDeps).filter((name) => name.includes('fontsource') || name.includes('webfont'))
    expect(fontPackages).toEqual([])
  })
})
