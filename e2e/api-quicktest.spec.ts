import { test, expect } from '@playwright/test'

test.describe('API QuickTest Core Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('1. Loads initial state with brand identity and sample GET request', async ({ page }) => {
    await expect(page.locator('text=API QuickTest')).toBeVisible()
    await expect(page.locator('text=Send. Inspect. Understand.')).toBeVisible()
    await expect(page.locator('select[aria-label="HTTP Method"]')).toHaveValue('GET')
    await expect(page.locator('input[placeholder*="Enter request URL"]')).toHaveValue('{{baseUrl}}/api/test/users')
  })

  test('2. Sends GET request and inspects real response in Pretty view', async ({ page }) => {
    // Click Send
    await page.click('button:has-text("Send")')

    // Expect status 200 OK
    await expect(page.locator('text=200 OK')).toBeVisible({ timeout: 10000 })
    // Expect body containing users
    await expect(page.locator('text=Ada Lovelace')).toBeVisible()
    // Expect duration badge
    await expect(page.locator('span.font-mono:has-text("ms")')).toBeVisible()
  })

  test('3. Sends POST request with JSON body and verifies response', async ({ page }) => {
    // Select POST method
    await page.selectOption('select[aria-label="HTTP Method"]', 'POST')
    // Click Body tab
    await page.click('button:has-text("Body")')
    // Select JSON
    await page.click('button:has-text("JSON")')
    // Fill JSON body
    const bodyArea = page.locator('textarea')
    await bodyArea.fill(JSON.stringify({ name: 'Margaret Hamilton', role: 'Apollo Lead' }))

    // Click Send
    await page.click('button:has-text("Send")')

    // Expect status 201 Created
    await expect(page.locator('text=201 Created')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('pre:has-text("Margaret Hamilton")')).toBeVisible()
  })

  test('4. Sends PUT, PATCH, and DELETE requests', async ({ page }) => {
    // PUT
    await page.selectOption('select[aria-label="HTTP Method"]', 'PUT')
    await page.fill('input[placeholder*="Enter request URL"]', '{{baseUrl}}/api/test/users/1')
    await page.click('button:has-text("Send")')
    await expect(page.locator('text=full_replacement')).toBeVisible({ timeout: 10000 })

    // PATCH
    await page.selectOption('select[aria-label="HTTP Method"]', 'PATCH')
    await page.click('button:has-text("Send")')
    await expect(page.locator('text=partial_update')).toBeVisible({ timeout: 10000 })

    // DELETE
    await page.selectOption('select[aria-label="HTTP Method"]', 'DELETE')
    await page.click('button:has-text("Send")')
    await expect(page.locator('text=successfully deleted')).toBeVisible({ timeout: 10000 })
  })

  test('5. Configures query parameters and headers', async ({ page }) => {
    await page.selectOption('select[aria-label="HTTP Method"]', 'GET')
    // Params tab
    await page.click('button:has-text("Params")')
    await page.click('button:has-text("Add Parameter")')
    const keyInputs = page.locator('input[placeholder="Parameter Key"]')
    const valInputs = page.locator('input[placeholder="Value"]')
    await keyInputs.last().fill('search')
    await valInputs.last().fill('test-query')

    // Headers tab
    await page.click('button:has-text("Headers")')
    await page.click('button:has-text("Add Header")')
    const headerKeyInputs = page.locator('input[placeholder*="Header Name"]')
    const headerValInputs = page.locator('input[placeholder*="Value (e.g."]')
    await headerKeyInputs.last().fill('X-Client-App')
    await headerValInputs.last().fill('PlaywrightTest')

    // Send request
    await page.click('button:has-text("Send")')
    await expect(page.locator('text=200 OK')).toBeVisible({ timeout: 10000 })
  })

  test('6. Switches authorization mode and confirms secrets are masked', async ({ page }) => {
    await page.click('button:has-text("Authorization")')
    const authSelect = page.locator('select[aria-label="Auth Type"]')
    await authSelect.selectOption('bearer')

    const tokenInput = page.locator('input[placeholder="eyJhbGciOiJIUzI1NiIsIn..."]')
    await expect(tokenInput).toHaveAttribute('type', 'password')
    await tokenInput.fill('my_secret_bearer_token')

    // Toggle reveal
    const eyeBtn = page.locator('button:has(svg.lucide-eye)')
    await eyeBtn.click()
    await expect(tokenInput).toHaveAttribute('type', 'text')
  })

  test('7. Inspects Raw, Headers, and Pretty tabs and response search', async ({ page }) => {
    await page.click('button:has-text("Send")')
    await expect(page.locator('text=200 OK')).toBeVisible({ timeout: 10000 })

    // Raw tab
    await page.click('button:has-text("Raw")')
    await expect(page.locator('pre:has-text("Ada Lovelace")')).toBeVisible()

    // Headers tab
    await page.click('button:has-text("Headers (")')
    await expect(page.locator('td:has-text("content-type")')).toBeVisible()

    // Search input
    await page.click('button:has-text("Pretty")')
    const searchInput = page.locator('input[placeholder="Search response..."]')
    await searchInput.fill('Lovelace')
    await expect(page.locator('text=match')).toBeVisible()
  })

  test('8. Handles 404, 204 No Content, invalid URL, and invalid JSON', async ({ page }) => {
    // 404 Not Found
    await page.fill('input[placeholder*="Enter request URL"]', '{{baseUrl}}/api/test/status/404')
    await page.click('button:has-text("Send")')
    await expect(page.locator('text=404 Not Found')).toBeVisible({ timeout: 10000 })

    // 204 No Content
    await page.fill('input[placeholder*="Enter request URL"]', '{{baseUrl}}/api/test/status/204')
    await page.click('button:has-text("Send")')
    await expect(page.locator('span:has-text("204 No Content")')).toBeVisible({ timeout: 10000 })

    // Invalid URL protocol
    await page.fill('input[placeholder*="Enter request URL"]', 'file:///etc/passwd')
    await expect(page.locator('text=not supported')).toBeVisible()

    // Invalid JSON body validation warning
    await page.selectOption('select[aria-label="HTTP Method"]', 'POST')
    await page.click('button:has-text("Body")')
    await page.click('button:has-text("JSON")')
    await page.locator('textarea').fill('{ invalid json body')
    await expect(page.locator('text=JSON Syntax:')).toBeVisible()
  })

  test('9. Response Assertions evaluate pass and fail states', async ({ page }) => {
    await page.fill('input[placeholder*="Enter request URL"]', '{{baseUrl}}/api/test/users')
    await page.selectOption('select[aria-label="HTTP Method"]', 'GET')
    await page.click('button:has-text("Assertions")')

    // Add failing assertion
    await page.click('button:has-text("Add Assertion")')
    const expectedInputs = page.locator('input[placeholder="Expected Value"]')
    await expectedInputs.last().fill('404') // Will fail because status is 200

    await page.click('button:has-text("Send")')
    await expect(page.locator('text=200 OK')).toBeVisible({ timeout: 10000 })

    // Check Assertions tab
    await page.locator('button:has-text("Assertions")').last().click()
    await expect(page.locator('text=PASS — STATUS CODE EQUALS')).toBeVisible()
    await expect(page.locator('text=FAIL — STATUS CODE EQUALS')).toBeVisible()
  })

  test('10. Code Snippets generator modal works with cURL and fetch', async ({ page }) => {
    await page.click('button:has-text("Snippets")')
    await expect(page.locator('h2:has-text("Code Snippets")')).toBeVisible()
    await expect(page.locator('pre:has-text("curl")')).toBeVisible()

    // Switch to fetch
    await page.click('button:has-text("JavaScript (fetch)")')
    await expect(page.locator('pre:has-text("async function executeRequest()")')).toBeVisible()

    // Close
    await page.keyboard.press('Escape')
  })

  test('11. Recipes modal loads pre-built workflows into builder', async ({ page }) => {
    await page.click('button:has-text("Recipes")')
    await expect(page.locator('text=API Recipes & Quick Start')).toBeVisible()

    // Load recipe 3: Create a new record (POST)
    await page.click('[data-recipe-id="recipe_create"] button')

    // Expect method to be POST and URL updated
    await expect(page.locator('select[aria-label="HTTP Method"]')).toHaveValue('POST')
    await expect(page.locator('input[placeholder*="Enter request URL"]')).toHaveValue('{{baseUrl}}/api/test/users')
  })

  test('12. Environment switching and variable substitution', async ({ page }) => {
    const envSelect = page.locator('select[aria-label="Active Environment"]')
    await envSelect.selectOption({ label: 'Staging' })

    // Notice preview updates to staging baseUrl
    await expect(page.locator('span[title*="staging.api.example.com"]')).toBeVisible()
  })

  test('13. Responsive viewport tests at 375, 768, 1024, and 1440px with no horizontal overflow', async ({ page }) => {
    const widths = [375, 768, 1024, 1440]
    for (const w of widths) {
      await page.setViewportSize({ width: w, height: 800 })
      await page.waitForTimeout(100)

      // Ensure no horizontal document overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2) // small tolerance for browser scrollbar
    }
  })
})
