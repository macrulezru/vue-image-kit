import { test, expect, type Page } from '@playwright/test'
import { gotoTab } from './utils'

const CASES = ['max', 'wide', 'half', 'auto', 'height']

async function measure(page: Page, freeze: boolean): Promise<Record<string, [number, number]>> {
  if (freeze) {
    await page.addInitScript(() => {
      class NoopIntersectionObserver {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      }
      // @ts-expect-error test-only stub: never reports intersection, keeping VImage in its idle state
      window.IntersectionObserver = NoopIntersectionObserver
    })
  }
  await page.setViewportSize({ width: 1000, height: 1200 })
  await page.goto('/')
  await gotoTab(page, 'Responsive sources')
  await page.getByTestId('same-size-demo').scrollIntoViewIfNeeded()

  const sizes: Record<string, [number, number]> = {}
  for (const id of CASES) {
    const image = page.getByTestId(`same-size-image-${id}`)
    if (!freeze) {
      await page.evaluate(
        (testId) => document.querySelector('[data-testid="' + testId + '"]')?.scrollIntoView(),
        'same-size-image-' + id,
      )
      await expect(image).toHaveAttribute('alt', 'Portrait', { timeout: 10_000 })
      await expect(image).toHaveJSProperty('complete', true, { timeout: 10_000 })
    } else {
      await expect(image).toHaveAttribute('aria-hidden', 'true')
    }
    const box = await image.boundingBox()
    expect(box).not.toBeNull()
    sizes[id] = [Math.round(box!.width), Math.round(box!.height)]
  }
  return sizes
}

test.describe('placeholder box equals the loaded image box', () => {
  test('every sizing rule gives the placeholder the size of the loaded image', async ({
    browser,
  }) => {
    const idlePage = await (await browser.newContext()).newPage()
    const idle = await measure(idlePage, true)
    const loadedPage = await (await browser.newContext()).newPage()
    const loaded = await measure(loadedPage, false)

    for (const id of CASES) {
      expect(idle[id], id).toEqual(loaded[id])
      expect(idle[id]![0], id).toBeGreaterThan(60)
    }
  })
})

test.describe('box while the real image is still downloading', () => {
  test('the box does not change when the delayed image arrives', async ({ page }) => {
    await page.route('**/art-direction-portrait.jpg*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500))
      await route.continue()
    })
    await page.setViewportSize({ width: 1000, height: 1200 })
    await page.goto('/')
    await gotoTab(page, 'Responsive sources')

    for (const id of ['max', 'wide', 'half', 'auto', 'height']) {
      const image = page.getByTestId(`same-size-image-${id}`)
      await page.evaluate(
        (testId) => document.querySelector(`[data-testid="${testId}"]`)?.scrollIntoView(),
        `same-size-image-${id}`,
      )
      await expect(image).toHaveAttribute('src', /art-direction-portrait/, { timeout: 5_000 })
      const during = await image.boundingBox()
      await expect(image).toHaveJSProperty('complete', true, { timeout: 15_000 })
      await page.waitForTimeout(100)
      const after = await image.boundingBox()
      expect(during, id).not.toBeNull()
      expect([Math.round(during!.width), Math.round(during!.height)], id).toEqual([
        Math.round(after!.width),
        Math.round(after!.height),
      ])
    }
  })
})
