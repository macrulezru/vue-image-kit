import { test, expect } from '@playwright/test'
import { gotoTab } from './utils'

test.describe('blurhash placeholder blur-up', () => {
  test('the blurhash background is cleared once the real image has loaded', async ({ page }) => {
    await page.route('**/images/photo-1.jpg', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      await route.continue()
    })

    await page.goto('/')
    await gotoTab(page, 'Basic')

    const panel = page.locator('.panel', { hasText: 'Preview' })
    const img = panel.locator('img[alt="photo-1"]')

    await expect(img).not.toHaveCSS('background-image', 'none')
    await expect(img).toHaveJSProperty('complete', true, { timeout: 10_000 })
    await expect(img).toHaveCSS('background-image', 'none')
  })
})
