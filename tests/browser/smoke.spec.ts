import { test, expect } from '@playwright/test'

// Every page listed here is opened at every size in playwright.config.ts.
// Add a line when a new screen is built.
const pages = [{ name: 'home', path: './' }]

for (const p of pages) {
  test(`${p.name} loads cleanly`, async ({ page }, info) => {
    const problems: string[] = []
    page.on('pageerror', e => problems.push(`page error: ${e.message}`))
    page.on('console', m => { if (m.type() === 'error') problems.push(`console error: ${m.text()}`) })

    await page.goto(p.path)
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveTitle("Hanh's Log")
    await expect(page.locator('#root')).not.toBeEmpty()

    // Nothing should force sideways scrolling at any size.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, 'page is wider than the screen (sideways scroll)').toBeLessThanOrEqual(0)

    await page.screenshot({ path: `test-results/screens/${p.name}-${info.project.name}.png`, fullPage: true })
    expect(problems, problems.join('\n')).toEqual([])
  })
}
