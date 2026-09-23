import { test, expect } from '@playwright/test'
import { gotoTab } from './utils'

test.describe('priority prop', () => {
  test('sets fetchpriority=high and decoding=sync on the real <img>, and loads it', async ({ page }) => {
    await page.goto('/')
    await gotoTab(page, 'Layout & priority')

    const img = page.getByTestId('priority-image')

    await expect(img).toHaveAttribute('fetchpriority', 'high')
    await expect(img).toHaveAttribute('decoding', 'sync')

    await expect(img).toHaveJSProperty('complete', true, { timeout: 10_000 })
  })
})
