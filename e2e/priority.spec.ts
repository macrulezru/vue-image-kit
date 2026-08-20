import { test, expect } from '@playwright/test'
import { gotoTab } from './utils'

// `priority` forces fetchpriority/decoding/eager-loading — worth confirming
// the real attributes land on the real <img>, not just that our own
// merged-computed logic returns the right values in a unit test.
test.describe('priority prop', () => {
  test('sets fetchpriority=high and decoding=sync on the real <img>, and loads it', async ({ page }) => {
    await page.goto('/')
    await gotoTab(page, 'Layout & priority')

    const wrapper = page.getByTestId('priority-image')
    const img = wrapper.locator('img:not([aria-hidden])')

    await expect(img).toHaveAttribute('fetchpriority', 'high')
    await expect(img).toHaveAttribute('decoding', 'sync')

    // Eager (not lazy) — should already be loaded without any scrolling.
    await expect(img).toHaveJSProperty('complete', true, { timeout: 10_000 })
  })
})
