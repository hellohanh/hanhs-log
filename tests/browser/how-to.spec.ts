import { test, expect } from '@playwright/test'

// The how-to page (session 15): a plain page at /how-to/, outside the app,
// dark, with screenshots. It must load cleanly at every size, show every
// picture, and never scroll sideways.
test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }))
})

test('the how-to page loads with every chapter and picture', async ({ page }, info) => {
  const problems: string[] = []
  page.on('pageerror', e => problems.push(e.message))
  page.on('console', m => { if (m.type() === 'error') problems.push(m.text()) })
  await page.goto('./how-to/')
  await expect(page).toHaveTitle("Hanh's Log Field Guide")
  await expect(page.getByRole('heading', { level: 1 })).toContainText("Hanh's Log")
  const chapters = page.locator('section.chapter h2')
  await expect(chapters).toHaveCount(10)
  // Every picture is there (scroll them into view so lazy ones load).
  const imgs = page.locator('main img')
  const n = await imgs.count()
  expect(n).toBeGreaterThanOrEqual(19)
  for (let i = 0; i < n; i++) {
    await imgs.nth(i).scrollIntoViewIfNeeded()
    await expect.poll(() => imgs.nth(i).evaluate(el => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0)).toBe(true)
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, 'page is wider than the screen').toBeLessThanOrEqual(0)
  // The contents jump to a chapter; Back goes to the app.
  await page.getByRole('navigation', { name: 'Contents' }).getByRole('link', { name: 'No signal' }).click()
  await expect(page).toHaveURL(/#offline$/)
  await expect(page.getByRole('link', { name: "← Back to Hanh's Log" })).toHaveAttribute('href', '../')
  await page.screenshot({ path: `test-results/screens/how-to-${info.project.name}.png` })
  expect(problems, problems.join('\n')).toEqual([])
})
