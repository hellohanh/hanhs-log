import { test, expect } from '@playwright/test'

// The splash page: plane flight, hand-over to the painted plane, the two
// section panels, and the city search.

test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' })
  )
})

test('the plane flies, hands over to the painted plane, and the panels come up', async ({ page }) => {
  await page.goto('./')
  const main = page.locator('main')
  const flying = page.getByTestId('flying-plane')

  // Mid-flight: the panels are still hidden and the plane is moving.
  await expect(main).toHaveAttribute('data-landed', 'false')
  const first = await flying.getAttribute('transform')
  await page.waitForTimeout(800)
  expect(await flying.getAttribute('transform')).not.toEqual(first)

  // About 7 seconds in: landed, flying plane gone, page glides to the panels.
  await expect(main).toHaveAttribute('data-landed', 'true', { timeout: 10_000 })
  await expect.poll(() => flying.getAttribute('opacity'), { timeout: 3_000 }).toBe('0.000')
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 4_000 }).toBeGreaterThan(100)
  await expect(page.getByRole('heading', { name: 'Where to?' })).toBeInViewport()

  // Fly again starts the flight over.
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.getByRole('button', { name: 'Fly again' }).click()
  await expect(main).toHaveAttribute('data-landed', 'false')
  await expect(flying).toHaveAttribute('opacity', '1.000')
})

test.describe('with reduced motion', () => {
  test('shows the finished picture and the panels straight away', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('./')
    await expect(page.locator('main')).toHaveAttribute('data-landed', 'true')
    await expect(page.getByTestId('flying-plane')).toHaveAttribute('opacity', '0.000')
    await page.getByRole('link', { name: /Remember the meals/ }).click()
    await expect(page).toHaveURL(/\/savor$/)
    await page.goBack()
    await page.getByRole('link', { name: /Plan the days/ }).click()
    await expect(page).toHaveURL(/\/wander$/)
  })
})

test('city search opens one results page for that city', async ({ page }) => {
  await page.goto('./')
  const box = page.getByRole('searchbox', { name: 'Where are you going?' })
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page.getByText('Enter a city first.')).toBeVisible()
  await box.fill('Rome')
  await expect(page.getByText('Enter a city first.')).toHaveCount(0)
  await box.press('Enter')
  await expect(page).toHaveURL(/\/search\?city=Rome$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rome')
  await expect(page.getByRole('heading', { name: 'Your trips in Rome' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your eateries in Rome' })).toBeVisible()
})
