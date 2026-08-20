import { test, expect } from '@playwright/test'
import { gotoTab } from './utils'

// VImage's lazy loading is driven by a real IntersectionObserver, which jsdom
// cannot exercise faithfully — this verifies the actual load-on-viewport-entry
// behavior in a real browser, including the shared-observer pool at scale
// (64 images sharing IntersectionObserver instances).
test.describe('lazy loading (IntersectionObserver)', () => {
  test('above-the-fold images load immediately; below-the-fold images load only once scrolled into view', async ({ page }) => {
    await page.goto('/')
    await gotoTab(page, 'Lazy Load')

    const cells = page.locator('.lazy-cell')
    await expect(cells).toHaveCount(64)

    const firstBadge = cells.nth(0).locator('.lazy-status .badge')
    await expect(firstBadge).toHaveClass(/badge-loaded/, { timeout: 10_000 })

    const farCell = cells.nth(40)
    const farBadge = farCell.locator('.lazy-status .badge')
    await expect(farBadge).toHaveClass(/badge-idle/)

    await farCell.scrollIntoViewIfNeeded()
    await expect(farBadge).toHaveClass(/badge-loaded/, { timeout: 10_000 })
  })
})
