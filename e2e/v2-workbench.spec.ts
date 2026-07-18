import { expect, test } from '@playwright/test'

const WORKBENCH_STORAGE_KEY = 'ev-valuation-simulator:workbench:v2'

test.beforeEach(async ({ page }) => {
  await page.goto('/#/')
  await page.evaluate((key) => localStorage.removeItem(key), WORKBENCH_STORAGE_KEY)
  await page.reload()
})

test('V2-1. ルートに4ケースのInvestment Case Workbenchが表示される', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await expect(page.getByRole('heading', { name: '企業価値・投資リターン シナリオ設計' })).toBeVisible()
  await expect(page.locator('.workbench-case-card')).toHaveCount(4)
  await expect(page.getByRole('heading', { name: '投資ケース比較' })).toBeVisible()
  expect(errors).toEqual([])
})

test('V2-2. 会社の現在ARRを変更するとExit企業価値が再計算される', async ({ page }) => {
  const resultsTable = page.locator('.workbench-results')
  const before = await resultsTable.locator('tbody tr').nth(2).locator('td').nth(1).innerText()
  await page.getByLabel('現在ARR').fill('2000')
  const after = await resultsTable.locator('tbody tr').nth(2).locator('td').nth(1).innerText()
  expect(after).not.toBe(before)
})

test('V2-3. 入力はlocalStorageへ保存され、リロード後に復元される', async ({ page }) => {
  await page.getByLabel('会社名').fill('V2 E2E株式会社')
  await page.getByLabel('提示Pre-money（百万円）').fill('4500')
  await page.waitForTimeout(50)
  await page.reload()
  await expect(page.getByLabel('会社名')).toHaveValue('V2 E2E株式会社')
  await expect(page.getByLabel('提示Pre-money（百万円）')).toHaveValue('4500')
})

test('V2-4. Excelエクスポートでxlsxファイルが生成される', async ({ page }) => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Excelエクスポート' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/)
  expect(await download.path()).toBeTruthy()
})
