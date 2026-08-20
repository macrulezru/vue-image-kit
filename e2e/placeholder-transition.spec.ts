import { test, expect } from '@playwright/test'
import { gotoTab } from './utils'

// The blur-up handoff depends on a real decoded <img> and computed CSS
// opacity — not something jsdom's fake image loading can validate.
test.describe('blurhash placeholder blur-up', () => {
  test('the blurhash canvas fades out once the real image has loaded', async ({ page }) => {
    await page.goto('/')
    await gotoTab(page, 'Basic')

    const panel = page.locator('.panel', { hasText: 'Preview' })
    const canvas = panel.locator('canvas')
    const img = panel.locator('img[alt="photo-1"]')

    await expect(canvas).toBeVisible()
    await expect(img).toHaveCSS('opacity', '1', { timeout: 10_000 })
    await expect(canvas).toHaveCSS('opacity', '0')
  })
})
