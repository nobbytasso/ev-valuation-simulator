/** E2Eスモーク共通ヘルパー。V2導入後も旧シナリオ回帰テストは /legacy で実行する。 */
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export async function resetStorage(page: Page) {
  await page.goto('/#/legacy')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.getByRole('heading', { name: 'シナリオ一覧' })).toBeVisible()
}

export async function createScenario(page: Page, sectorLabel: string): Promise<string> {
  await page.goto('/#/legacy')
  await expect(page.getByRole('heading', { name: 'シナリオ一覧' })).toBeVisible()
  await page.locator('select').first().selectOption({ label: sectorLabel })
  await page.click('button:has-text("新規作成")')
  const link = page.locator('table tbody tr td a').last()
  await link.click()
  await expect(page.getByRole('heading', { name: '結果', level: 2 })).toBeVisible()
  return page.url()
}
