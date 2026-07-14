/**
 * Phase 4回帰用の最小E2Eスモーク(@playwright/test)。
 * 出典: docs/logs/phase4-verification-assessment-20260714.md §4タスク2、
 *       docs/logs/phase4-browser-verification-20260714.md §3(落とし穴3点)
 *
 * 落とし穴(必ず踏まえること):
 * 1. トルネード表はspan降順で自動ソートされるため、行は位置ではなくラベルで追跡する。
 * 2. localStorageを直接書き換えた場合、HashRouterのハッシュのみが変わる遷移では
 *    Zustandストアの読み込み済み状態が残るため、明示的にreload()する。
 * 3. テーマ切替ボタンはaria-label="テーマ切替"を持つため、アクセシブルネームは
 *    可視テキスト(「ライトモードへ切替」等)ではなくaria-labelの値になる。
 */
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createScenario, resetStorage } from './helpers.ts'

const SCENARIO_STORAGE_KEY = 'ev-valuation-simulator:scenarios:v1'
const THEME_STORAGE_KEY = 'ev-valuation-simulator:theme'

test.beforeEach(async ({ page }) => {
  await resetStorage(page)
})

test('1. シナリオ新規作成→感度分析セクションが描画され、コンソールエラーがゼロ', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))

  await createScenario(page, 'SaaS(日本)')

  await expect(page.getByRole('heading', { name: '感度分析(トルネードチャート)' })).toBeVisible()
  await expect(page.locator('.sensitivity-section svg').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: '資本政策・希薄化シミュレーター' })).toBeVisible()
  expect(errors).toEqual([])
})

test('2. トルネードのドライバー毎δ変更で再計算される(行はラベルで追跡)', async ({ page }) => {
  await createScenario(page, '創薬')

  const rows = page.locator('.sensitivity-section__table tbody tr')
  await expect(rows.first()).toBeVisible()
  const rowCount = await rows.count()

  let targetIndex = -1
  for (let i = 0; i < rowCount; i++) {
    if ((await rows.nth(i).locator('input[type="number"]').count()) > 0) {
      targetIndex = i
      break
    }
  }
  expect(targetIndex).toBeGreaterThanOrEqual(0)

  const targetLabel = await rows.nth(targetIndex).locator('td').first().innerText()
  const spanBefore = await rows.nth(targetIndex).locator('td').nth(3).innerText()
  const input = rows.nth(targetIndex).locator('input[type="number"]')
  await input.fill('5')
  await page.waitForTimeout(150)

  // span降順で再ソートされるため、位置ではなくラベルで対象行を再特定する。
  const rowAfter = page.locator('.sensitivity-section__table tbody tr', { hasText: targetLabel }).first()
  const spanAfter = await rowAfter.locator('td').nth(3).innerText()
  expect(spanAfter).not.toBe(spanBefore)
})

test('3. 資本政策: 中間ラウンド削除後も後続行の入力値が行ズレしない', async ({ page }) => {
  await createScenario(page, 'SaaS(日本)')

  const addRoundBtn = page.getByRole('button', { name: '＋ ラウンドを追加' })
  await addRoundBtn.click()
  await addRoundBtn.click()
  await addRoundBtn.click()

  const roundRows = page.locator('h3:has-text("将来ラウンド") + table tbody tr')
  await expect(roundRows).toHaveCount(3)

  const preMoneyValues = [1000, 2000, 3000]
  for (let i = 0; i < 3; i++) {
    await roundRows.nth(i).locator('input[type="number"]').nth(1).fill(String(preMoneyValues[i]))
  }

  await page.getByRole('button', { name: 'ラウンドを削除' }).nth(1).click()

  const remaining = page.locator('h3:has-text("将来ラウンド") + table tbody tr')
  await expect(remaining).toHaveCount(2)
  await expect(remaining.nth(0).locator('input[type="number"]').nth(1)).toHaveValue('1000')
  await expect(remaining.nth(1).locator('input[type="number"]').nth(1)).toHaveValue('3000')
})

test('4. capitalPolicyの保存→リロードで復元される', async ({ page }) => {
  await createScenario(page, 'SaaS(日本)')

  await page.getByRole('button', { name: '＋ ラウンドを追加' }).click()
  const nameInput = page.locator('h3:has-text("将来ラウンド") + table tbody tr').first().locator('input[type="text"]')
  await nameInput.fill('E2ERound')

  await page.getByRole('button', { name: '保存' }).click()
  await page.reload()

  await expect(page.getByRole('heading', { name: '資本政策・希薄化シミュレーター' })).toBeVisible()
  await expect(
    page.locator('h3:has-text("将来ラウンド") + table tbody tr').first().locator('input[type="text"]'),
  ).toHaveValue('E2ERound')
})

test('5. exitEvSourceセレクトの切替で手取り額が変化する', async ({ page }) => {
  await createScenario(page, 'SaaS(日本)')

  await page.getByRole('button', { name: '＋ ラウンドを追加' }).click()
  const roundRow = page.locator('h3:has-text("将来ラウンド") + table tbody tr').first()
  await roundRow.locator('input[type="number"]').nth(4).fill('300') // 自ファンド出資額
  await page.waitForTimeout(150)

  const payoutRegex = /Exit時 自社\(ファンド\)手取り合計: ([^\n]+)/
  const before = await page.locator('.capital-policy-section').innerText()
  const payoutBefore = payoutRegex.exec(before)?.[1]
  expect(payoutBefore).toBeTruthy()

  await page.getByLabel('Exit企業価値の参照レンジ点').selectOption({ label: '楽観' })
  await page.waitForTimeout(150)

  const after = await page.locator('.capital-policy-section').innerText()
  const payoutAfter = payoutRegex.exec(after)?.[1]
  expect(payoutAfter).not.toBe(payoutBefore)
})

test('6. v1形式データを注入→明示リロード→クラッシュせず資本政策が既定値表示(移行)', async ({ page }) => {
  const legacyV1 = {
    id: 'legacy-saas-0001',
    name: 'Phase2形式レガシーシナリオ(SaaS)',
    sector: 'saas_jp',
    inputs: {
      arr: 1000,
      arrGrowth: 0.3,
      nrr: 1.1,
      grossMargin: 0.7,
      operatingMargin: 0.05,
      fcfMargin: 0.05,
      grossChurn: 0.1,
      cacPaybackMonths: 18,
      arrBasis: 'ntm',
      evArrMultiple: { pessimistic: 5, base: 8, optimistic: 12 },
      projectionYears: 5,
      growthDecayFactor: 0.85,
      discountRate: 0.12,
      terminalGrowth: 0.02,
    },
    createdAt: '2026-07-13T10:00:00.000Z',
    updatedAt: '2026-07-13T10:00:00.000Z',
  }

  await page.evaluate(
    ({ key, legacy }) => {
      localStorage.setItem(key, JSON.stringify([legacy]))
    },
    { key: SCENARIO_STORAGE_KEY, legacy: legacyV1 },
  )
  // HashRouterのハッシュのみの遷移はフルリロードを伴わずZustandストアが再読込されないため、
  // hashを設定したうえで明示的にreload()する(落とし穴2)。
  await page.evaluate((id) => {
    window.location.hash = `#/scenarios/${id}`
  }, legacyV1.id)
  await page.reload()

  await expect(page.getByRole('heading', { name: '結果', exact: true })).toBeVisible()
  const capitalPolicyText = await page.locator('.capital-policy-section').innerText()
  expect(capitalPolicyText).toContain('創業者')
})

test('7. JSONエクスポート→インポートの往復', async ({ page }) => {
  await createScenario(page, 'SaaS(日本)')
  await page.goto('/#/')
  await expect(page.getByRole('heading', { name: 'シナリオ一覧' })).toBeVisible()

  const rowsBefore = await page.locator('table tbody tr').count()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'エクスポート' }).first().click(),
  ])
  const filePath = await download.path()
  expect(filePath).toBeTruthy()
  const parsed = JSON.parse(readFileSync(filePath as string, 'utf-8'))
  expect(parsed.capitalPolicy).toBeTruthy()

  await page.setInputFiles('input[type="file"]', filePath as string)
  await expect(page.locator('table tbody tr')).toHaveCount(rowsBefore + 1)
})

test('8. テーマ切替(aria-label)+FOUC回帰防止(t=0でdata-theme・トークン値が確定している)', async ({ page, browser }) => {
  // テーマ切替ボタンはaria-label="テーマ切替"を持つ(落とし穴3)。可視テキストでは照会しない。
  const toggle = page.getByRole('button', { name: 'テーマ切替' })
  await expect(toggle).toBeVisible()
  await expect(toggle).toHaveText('ライトモードへ切替')
  await toggle.click()
  await expect(toggle).toHaveText('ダークモードへ切替')

  // FOUC回帰防止の本体はdata-theme属性とトークン値(CSSカスタムプロパティ)の即時確定を見る。
  // body の background-color/color は開発サーバーではVite側のCSS遅延注入(本修正と無関係な
  // 別要因)でリロード直後に未反映のことがあるため、導出値ではなくトークン自体を検証する
  // (docs/logs/phase4-browser-verification-20260714.md・phase4-verification-assessment-20260714.md参照)。
  async function readThemeState(p: Page) {
    return p.evaluate(() => {
      const cs = getComputedStyle(document.documentElement)
      return {
        dataTheme: document.documentElement.getAttribute('data-theme'),
        tokenBg: cs.getPropertyValue('--color-bg').trim(),
        tokenText: cs.getPropertyValue('--color-text').trim(),
      }
    })
  }

  // FOUC回帰防止(通常): 保存テーマ=lightでリロード直後、data-theme・トークンが確定していること。
  await page.evaluate((key) => localStorage.setItem(key, 'light'), THEME_STORAGE_KEY)
  await page.reload()
  const normal = await readThemeState(page)
  expect(normal.dataTheme).toBe('light')
  expect(normal.tokenBg).toBe('#fffbfd')
  expect(normal.tokenText).toBe('#3a2933')

  // FOUC回帰防止(reduced-motion): 動きを減らす設定でも同様に初回描画から確定していること。
  const reducedContext = await browser.newContext({ reducedMotion: 'reduce' })
  const reducedPage = await reducedContext.newPage()
  await reducedPage.goto('/#/')
  await reducedPage.evaluate((key) => localStorage.setItem(key, 'dark'), THEME_STORAGE_KEY)
  await reducedPage.reload()
  const reduced = await readThemeState(reducedPage)
  expect(reduced.dataTheme).toBe('dark')
  expect(reduced.tokenBg).toBe('#05080a')
  expect(reduced.tokenText).toBe('#d7f2f0')
  await reducedContext.close()
})
