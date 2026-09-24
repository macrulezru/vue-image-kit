import { test, expect } from '@playwright/test'
import { gotoTab } from './utils'

const TABLET_MEDIA = '(max-width: 1024px)'
const DESKTOP_RATIO = 720 / 1237
const TABLET_RATIO = 1400 / 700

test.describe('art-direction sources — per-breakpoint width/height', () => {
  test('tablet viewport selects the tablet source with a matching loaded aspect ratio', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 800, height: 1000 })
    await page.goto('/')
    await gotoTab(page, 'Responsive sources')

    await page.getByTestId('sizes-demo-box').scrollIntoViewIfNeeded()

    const source = page.locator(`[data-testid="sizes-demo-image"] source[media="${TABLET_MEDIA}"]`)
    await expect(source).toHaveAttribute('width', '1400')
    await expect(source).toHaveAttribute('height', '700')

    const img = page.locator('[data-testid="sizes-demo-image"] img')
    await expect(img).toHaveJSProperty('complete', true, { timeout: 10_000 })

    const box = await img.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width / box!.height).toBeCloseTo(TABLET_RATIO, 1)
  })

  test('resizing the viewport before the image loads changes the idle placeholder proportions', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      class NoopIntersectionObserver {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      }
      // @ts-expect-error test-only stub: never reports intersection, keeping VImage in its idle state
      window.IntersectionObserver = NoopIntersectionObserver
    })

    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await gotoTab(page, 'Responsive sources')

    const placeholder = page.getByTestId('sizes-demo-image')
    await expect(placeholder).toBeVisible()

    const desktopBox = await placeholder.boundingBox()
    expect(desktopBox).not.toBeNull()
    expect(desktopBox!.width / desktopBox!.height).toBeCloseTo(DESKTOP_RATIO, 1)

    await page.setViewportSize({ width: 800, height: 1000 })

    await expect(async () => {
      const tabletBox = await placeholder.boundingBox()
      expect(tabletBox).not.toBeNull()
      expect(tabletBox!.width / tabletBox!.height).toBeCloseTo(TABLET_RATIO, 1)
    }).toPass({ timeout: 5_000 })

    await expect(placeholder).toHaveJSProperty('tagName', 'SPAN')
  })
})
