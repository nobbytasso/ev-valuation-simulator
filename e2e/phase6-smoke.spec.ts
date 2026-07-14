/**
 * Phase 6回帰用のE2Eスモーク(@playwright/test)。出典: docs/phase6-spec.md §8.2・§9
 * 各コミット(C1〜)で実装した機能について、既存の11本(phase4/5-smoke)を壊さず追加する。
 */
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import * as XLSX from 'xlsx'
import { createScenario, resetStorage } from './helpers.ts'

const MONEY_UNIT_STORAGE_KEY = 'ev-valuation-simulator:money-unit'

test.beforeEach(async ({ page }) => {
  await resetStorage(page)
})

test('C1-1. 金額単位トグル: 億円表示に切替→表が億円になり、リロードで永続する', async ({ page }) => {
  await createScenario(page, 'SaaS(日本)')

  // SaaS既定(ARR1000・成長30%・EV/ARRマルチプル8x)のEVベース=10,400百万円=104.0億円。
  await expect(page.getByText('企業価値(百万円)')).toBeVisible()
  const evTable = page.locator('table').filter({ hasText: '企業価値' }).first()
  await expect(evTable).toContainText('10,400')

  const unitToggle = page.getByRole('button', { name: '金額単位切替' })
  await unitToggle.click()

  await expect(page.getByText('企業価値(億円)')).toBeVisible()
  await expect(evTable).toContainText('104.0')

  await page.reload()
  await expect(page.getByText('企業価値(億円)')).toBeVisible()
  const stored = await page.evaluate((key) => localStorage.getItem(key), MONEY_UNIT_STORAGE_KEY)
  expect(stored).toBe('oku_yen')
})

test('C1-2. 億円表示中でもExcel出力は百万円のまま(ダウンロード読み戻し)', async ({ page }) => {
  await createScenario(page, 'SaaS(日本)')
  await page.getByRole('button', { name: '金額単位切替' }).click()
  await expect(page.getByText('企業価値(億円)')).toBeVisible()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Excelエクスポート' }).click(),
  ])
  const filePath = await download.path()
  expect(filePath).toBeTruthy()

  const workbook = XLSX.read(readFileSync(filePath as string), { type: 'buffer' })
  const flat = workbook.SheetNames.flatMap((name) =>
    XLSX.utils.sheet_to_json<(string | number)[]>(workbook.Sheets[name], { header: 1 }).flat(),
  )
  expect(flat).toContain('EVレンジ(百万円)')
  expect(flat).toContain(10400)
})

test('C1-3. 入力フォームの金額ラベルは単位切替の影響を受けない(百万円固定)', async ({ page }) => {
  await createScenario(page, 'SaaS(日本)')
  await page.getByRole('button', { name: '金額単位切替' }).click()
  await expect(page.getByText('企業価値(億円)')).toBeVisible()

  await expect(page.getByLabel('ARR(百万円)')).toBeVisible()
  await expect(page.getByLabel('投資額(百万円)')).toBeVisible()
})
