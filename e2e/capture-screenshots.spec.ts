import { test } from '@playwright/test'
import fs from 'fs'
import path from 'path'

test('Capture genuine application screenshots for documentation', async ({ page }) => {
  test.setTimeout(90000)
  const screenshotsDir = path.resolve('docs/screenshots')
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true })
  }

  // 1. Main Dashboard with real 200 OK Response
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.click('button:has-text("Send")')
  await page.waitForSelector('text=200 OK', { timeout: 10000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(screenshotsDir, '01-main-dashboard.png') })

  // 2. Response Assertions view
  await page.locator('button:has-text("Assertions")').last().click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(screenshotsDir, '05-response-assertions.png') })

  // 3. Code Snippets Modal
  await page.click('button:has-text("Snippets")')
  await page.waitForSelector('h2:has-text("Code Snippets")')
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(screenshotsDir, '03-code-snippets.png') })
  await page.locator('div[role="dialog"] button:has(svg.lucide-x), .fixed button:has(svg.lucide-x)').first().click()
  await page.waitForTimeout(300)

  // 4. Recipes Modal
  await page.click('button:has-text("Recipes")')
  await page.waitForSelector('text=API Recipes & Quick Start')
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(screenshotsDir, '02-recipes-modal.png') })
  await page.locator('div[role="dialog"] button:has(svg.lucide-x), .fixed button:has(svg.lucide-x)').first().click()
  await page.waitForTimeout(300)

  // 5. Environment Profiles Modal
  await page.click('button:has-text("Edit")')
  await page.waitForSelector('h2:has-text("Environment Profiles")')
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(screenshotsDir, '04-environment-modal.png') })
  await page.locator('div[role="dialog"] button:has(svg.lucide-x), .fixed button:has(svg.lucide-x)').first().click()
  await page.waitForTimeout(300)

  // 6. Light Theme
  await page.click('button[aria-label="Switch to light mode"]')
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(screenshotsDir, '06-light-theme.png') })

  // 7. Mobile View (375px)
  await page.setViewportSize({ width: 375, height: 812 })
  await page.click('button[aria-label="Switch to dark mode"]')
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(screenshotsDir, '07-mobile-responsive.png') })
})
