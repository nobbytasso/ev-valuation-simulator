/**
 * Phase 5回帰用の最小E2Eスモーク(@playwright/test)。出典: docs/phase5-spec.md §6 C8
 * 比較ビュー・ポートフォリオ紐付け・Excelエクスポートの3導線が実ブラウザで壊れていないことを確認する。
 */
import { expect, test } from '@playwright/test'
import { createScenario, resetStorage } from './helpers.ts'

test.beforeEach(async ({ page }) => {
  await resetStorage(page)
})

test('1. 比較ビュー: 2シナリオ選択→表とチャートが描画され、コンソールエラーがゼロ', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))

  await createScenario(page, 'SaaS(日本)')
  await createScenario(page, 'SaaS(日本)')

  await page.goto('/#/')
  await expect(page.getByRole('heading', { name: 'シナリオ一覧' })).toBeVisible()
  const checkboxes = page.locator('table tbody tr input[type="checkbox"]')
  await expect(checkboxes).toHaveCount(2)
  await checkboxes.nth(0).check()
  await checkboxes.nth(1).check()

  await page.getByRole('link', { name: /選択したシナリオを比較/ }).click()

  await expect(page.getByRole('heading', { name: 'シナリオ比較(2件)' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'EVレンジ' })).toBeVisible()
  await expect(page.locator('.scenario-compare-page svg').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: '共通指標' })).toBeVisible()
  expect(errors).toEqual([])
})

test('2. ポートフォリオ: シナリオ紐付けで時価・MOIC・IRRがコスト評価から切り替わる', async ({ page }) => {
  await createScenario(page, 'SaaS(日本)')

  await page.goto('/#/portfolio')
  await expect(page.getByRole('heading', { name: 'ポートフォリオ' })).toBeVisible()

  await page.getByPlaceholder('企業名').fill('E2E株式会社')
  await page.getByPlaceholder('投資額(百万円)').fill('300')
  await page.getByPlaceholder('持分(%)').fill('5')
  await page.getByLabel('投資日').fill('2020-01-01')
  await page.getByRole('button', { name: '追加' }).click()

  const row = page.locator('table tbody tr').first()
  await expect(row).toBeVisible()

  // 未紐付け時はコスト評価(投資額そのまま=300百万円)。
  await expect(row.locator('td').nth(7)).toContainText('300')
  await expect(row.locator('.portfolio-page__cost-badge')).toBeVisible()

  // 同一セクターのシナリオへ紐付ける(候補は先頭の「(未紐付け)」以外の1件)。
  await row.locator('select').selectOption({ index: 1 })
  await page.waitForTimeout(150)

  // SaaSデフォルト(ARR1000・成長30%・EV/ARRマルチプル8x)のEVベース=10400 × 持分5% = 520百万円。
  await expect(row.locator('td').nth(7)).toContainText('520')
  await expect(row.locator('.portfolio-page__cost-badge')).toHaveCount(0)
  await expect(row.locator('td').nth(9)).toContainText('x') // MOIC
  await expect(row.locator('td').nth(10)).toContainText('%') // IRR(投資日が過去のため数値が出る)
})

test('3. Excelダウンロード: シナリオ詳細のエクスポートボタンからxlsxファイルが生成される', async ({ page }) => {
  await createScenario(page, 'SaaS(日本)')

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Excelエクスポート' }).click(),
  ])

  expect(download.suggestedFilename()).toMatch(/\.xlsx$/)
  const filePath = await download.path()
  expect(filePath).toBeTruthy()
})
