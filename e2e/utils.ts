import type { Page } from '@playwright/test'

export async function gotoTab(page: Page, label: string): Promise<void> {
  await page.locator('.nav-item', { hasText: label }).click()
}
