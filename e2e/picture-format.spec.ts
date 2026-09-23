import { test, expect } from '@playwright/test'
import { gotoTab } from './utils'

test.describe('AVIF/WebP <picture> format switching', () => {
  test('renders typed <source> elements and the browser decodes one of them', async ({ page }) => {
    await page.goto('/')
    await gotoTab(page, 'AVIF / WebP')

    const panel = page.locator('.panel', { hasText: 'VImage with SrcSet object' })
    const picture = panel.locator('picture')

    await expect(picture.locator('source[type="image/avif"]')).toHaveAttribute('srcset', /\/images\/photo-\d+\.avif/)
    await expect(picture.locator('source[type="image/webp"]')).toHaveAttribute('srcset', /\/images\/photo-\d+\.webp/)

    const result = panel.getByTestId('picture-format-result')
    await expect(result).toHaveText(/photo-\d+\.(avif|webp)$/, { timeout: 10_000 })
  })
})
