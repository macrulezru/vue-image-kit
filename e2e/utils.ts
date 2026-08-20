import type { Page } from '@playwright/test'

/** Switch the demo app's sidebar to the tab whose label matches `label` exactly. */
export async function gotoTab(page: Page, label: string): Promise<void> {
  await page.locator('.nav-item', { hasText: label }).click()
}
