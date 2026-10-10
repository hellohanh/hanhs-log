import { test, expect } from '@playwright/test'

// Web fonts come from Google; serve an empty stylesheet in tests so results
// and screenshots don't depend on the network (system fonts are used).
test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' })
  )
})

// Every page listed here is opened at every size in playwright.config.ts.
// Add a line when a new screen is built.
const pages = [
  { name: 'home', path: './' },
  { name: 'wanderlog', path: './wander' },
  { name: 'wanderlog-trip', path: './wander/trip/test-trip' },
  { name: 'wanderlog-join', path: './wander/join/test-token' },
  { name: 'savorlog', path: './savor' },
  { name: 'signin', path: './signin' },
  { name: 'city-search', path: './search?city=Rome' },
  { name: 'zoom-preview', path: './zoom-preview' },
  { name: 'not-found', path: './no-such-page' }
]

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

test('light/dark switch flips the theme and is remembered', async ({ page }) => {
  await page.goto('./')
  const html = page.locator('html')
  const toggle = page.getByTestId('theme-toggle')
  await toggle.click()
  const first = await html.getAttribute('data-theme')
  expect(first === 'dark' || first === 'light').toBe(true)
  await page.reload()
  await expect(html).toHaveAttribute('data-theme', first!)
  await toggle.click()
  await expect(html).toHaveAttribute('data-theme', first === 'dark' ? 'light' : 'dark')
})

test('Wanderlog and Savorlog use Segoe UI; the splash and header keep the site fonts', async ({ page }) => {
  for (const path of ['./wander', './savor']) {
    await page.goto(path)
    await expect(page.locator('main h1')).toHaveCSS('font-family', /^"Segoe UI Web"/)
    await expect(page.locator('main .lede')).toHaveCSS('font-family', /^"Segoe UI Web"/)
    await expect(page.locator('header')).not.toHaveCSS('font-family', /Segoe UI Web/)
  }
  await page.goto('./')
  await expect(page.locator('h1').first()).toHaveCSS('font-family', /^Newsreader/)
})

test('header links move between sections', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('link', { name: 'Savorlog' }).first().click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Eateries by country and main dish')
  await page.getByRole('link', { name: 'Wanderlog' }).first().click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your trips')
})
