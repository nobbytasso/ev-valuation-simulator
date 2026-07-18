/**
 * V2本採用Batch 2(C4〜C7)の回帰E2E。出典: docs/v2-adoption-spec.md §7 C8
 * 既存 v2-workbench.spec.ts(V2-1〜V2-4)・phase4/5/6スモークは維持し、本ファイルは
 * Batch 2で追加した機能(クリック選択→チャート反映・追加出資・ポートフォリオV2連動・
 * %入力の浮動小数点表示)のみを対象にする。
 */
import { expect, test } from '@playwright/test'

const WORKBENCH_STORAGE_KEY = 'ev-valuation-simulator:workbench:v2'
const PORTFOLIO_STORAGE_KEY = 'ev-valuation-simulator:portfolio:v1'

test.beforeEach(async ({ page }) => {
  await page.goto('/#/')
  await page.evaluate(
    ({ workbenchKey, portfolioKey }) => {
      localStorage.removeItem(workbenchKey)
      localStorage.removeItem(portfolioKey)
    },
    { workbenchKey: WORKBENCH_STORAGE_KEY, portfolioKey: PORTFOLIO_STORAGE_KEY },
  )
  await page.reload()
  await page.waitForSelector('.workbench-case-card')
})

test('B2-1. ケース比較の列ヘッダをクリックすると採用ケースが選択され、投資家CF/円チャートに反映される', async ({ page }) => {
  // 未選択時は案内メッセージが出て、チャートは出ない。
  await expect(page.getByText('採用ケースが未選択です')).toBeVisible()
  await expect(page.locator('.workbench-adopted-charts')).toHaveCount(0)

  const header = page.locator('.workbench-adopt-header', { hasText: '会社計画' })
  await expect(header).toHaveAttribute('aria-pressed', 'false')
  await header.click()

  await expect(header).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.workbench-adopt-header__badge')).toHaveText('採用中')
  await expect(page.getByText('採用ケースが未選択です')).toHaveCount(0)

  // 投資家CF/円チャートが描画される。
  await expect(page.locator('.workbench-adopted-charts')).toBeVisible()
  await expect(page.locator('.workbench-adopted-charts .recharts-responsive-container').first()).toBeVisible()
  await expect(page.getByText('年次キャッシュフロー')).toBeVisible()
  await expect(page.getByText('回収額の構成')).toBeVisible()

  // 再クリックで解除(トグル)。
  await header.click()
  await expect(header).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByText('採用ケースが未選択です')).toBeVisible()
})

test('B2-2. ケースカードに追加出資行を追加すると倍率表示が現れ、通算MOICが変化する', async ({ page }) => {
  const firstCard = page.locator('.workbench-case-card').first()
  const summaryBefore = await firstCard.locator('.workbench-followon__summary').innerText()

  await firstCard.getByRole('button', { name: '＋ 追加出資を追加' }).click()

  const row = firstCard.locator('.workbench-followon__row').first()
  await expect(row).toBeVisible()
  await expect(row.locator('.workbench-followon__multiple')).toContainText('前回Post-money比: ×')

  const summaryAfter = await firstCard.locator('.workbench-followon__summary').innerText()
  expect(summaryAfter).not.toBe(summaryBefore)

  // Post-moneyを引き上げると倍率(上げ)の判定色クラスが付く。
  await row.getByLabel('ラウンドPost-money（百万円）').fill('10000')
  await expect(row.locator('.workbench-followon__multiple')).toHaveClass(/status-good/)

  // Post-moneyを引き下げると倍率(下げ)の判定色クラスに変わる。
  await row.getByLabel('ラウンドPost-money（百万円）').fill('1000')
  await expect(row.locator('.workbench-followon__multiple')).toHaveClass(/status-bad/)
})

test('B2-3. V2会社をポートフォリオへ紐付けると採用ケースの時価が反映される', async ({ page }) => {
  // Workbench側で会社計画ケースを採用しておく。
  await page.locator('.workbench-adopt-header', { hasText: '会社計画' }).click()
  await expect(page.locator('.workbench-adopt-header__badge')).toBeVisible()

  await page.goto('/#/portfolio')
  await expect(page.getByRole('heading', { name: 'ポートフォリオ' })).toBeVisible()

  await page.getByPlaceholder('企業名').fill('B2E2E株式会社')
  await page.getByPlaceholder('投資額(百万円)').fill('300')
  await page.getByPlaceholder('持分(%)').fill('10')
  await page.getByRole('button', { name: '追加' }).click()

  const row = page.locator('table tbody tr').first()
  await expect(row).toBeVisible()
  await expect(row.locator('.portfolio-page__cost-badge')).toBeVisible()

  await row.locator('select').selectOption({ label: 'V2: サンプル投資先' })
  await page.waitForTimeout(150)

  // V2連動評価に切り替わり、コスト評価バッジが消える(採用ケースの時価が反映される、R-V2-1)。
  await expect(row.locator('.portfolio-page__cost-badge')).toHaveCount(0)
  const marketValueCell = row.locator('td').nth(7)
  await expect(marketValueCell).not.toContainText('300 百万円')

  // ファンドCFバーチャート・時価構成円チャートが描画される。
  await expect(page.locator('.portfolio-page__charts')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'ファンドCF(V2連動・採用ケース確定銘柄)' })).toBeVisible()
})

test('B2-4. %フィールドは入力後も浮動小数点アーティファクトなしで整数表示される(7.000...が出ない)', async ({ page }) => {
  const firstCard = page.locator('.workbench-case-card').first()
  const marginField = firstCard.getByLabel('Exit時営業利益率')

  await marginField.fill('7')
  await marginField.blur()
  await expect(marginField).toHaveValue('7')

  // 内部的には0.07として保存され、再表示されても劣化しない(0.07*100=7.000000000000001の典型例)。
  await page.reload()
  await expect(firstCard.getByLabel('Exit時営業利益率')).toHaveValue('7')
})
