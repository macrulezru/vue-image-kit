import { test, expect } from '@playwright/test'
import { gotoTab } from './utils'

// The wrapper's sizing strategy is pure CSS (position/inset/aspect-ratio) —
// jsdom's layout engine is a no-op, so only a real browser can confirm the
// box actually ends up where the CSS says it should.
test.describe('layout presets (real CSS layout)', () => {
  test('fill absolutely fills its positioned parent', async ({ page }) => {
    await page.goto('/')
    await gotoTab(page, 'Layout & priority')

    const parent = page.getByTestId('layout-fill-parent')
    const fill = page.getByTestId('layout-fill')

    const parentBox = await parent.boundingBox()
    const fillBox = await fill.boundingBox()

    expect(parentBox).not.toBeNull()
    expect(fillBox).not.toBeNull()
    expect(fillBox!.width).toBeCloseTo(parentBox!.width, 0)
    expect(fillBox!.height).toBeCloseTo(parentBox!.height, 0)
    expect(fillBox!.x).toBeCloseTo(parentBox!.x, 0)
    expect(fillBox!.y).toBeCloseTo(parentBox!.y, 0)
  })

  test('fixed renders an exact width×height box', async ({ page }) => {
    await page.goto('/')
    await gotoTab(page, 'Layout & priority')

    const fixed = page.getByTestId('layout-fixed')
    const box = await fixed.boundingBox()

    expect(box).not.toBeNull()
    expect(Math.round(box!.width)).toBe(240)
    expect(Math.round(box!.height)).toBe(160)
  })

  test('responsive fills its container width', async ({ page }) => {
    await page.goto('/')
    await gotoTab(page, 'Layout & priority')

    const responsive = page.getByTestId('layout-responsive')
    const container = responsive.locator('xpath=..')

    const responsiveBox = await responsive.boundingBox()
    const containerBox = await container.boundingBox()

    expect(responsiveBox).not.toBeNull()
    expect(containerBox).not.toBeNull()
    expect(responsiveBox!.width).toBeCloseTo(containerBox!.width, 0)
  })
})
