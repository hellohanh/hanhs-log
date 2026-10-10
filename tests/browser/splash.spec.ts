import { test, expect } from '@playwright/test'

// The splash page: plane flight, hand-over to the painted plane, the two
// section panels, and the city search.

test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' })
  )
})

// Scroll so the pinned picture is `fraction` of the way through its stretch.
async function scrollThrough(page: import('@playwright/test').Page, fraction: number) {
  await page.evaluate(f => {
    const el = document.querySelector('section[aria-label="Introduction"]') as HTMLElement
    const pinned = el.firstElementChild as HTMLElement
    const stickyTop = parseFloat(getComputedStyle(pinned).top) || 0
    const top = el.getBoundingClientRect().top + window.scrollY - stickyTop
    window.scrollTo(0, top + (el.offsetHeight - pinned.offsetHeight) * f)
  }, fraction)
}

test('scrolling flies the plane, hands over to the painted plane, and brings up the panels', async ({ page }) => {
  await page.goto('./')
  const main = page.locator('main')
  const flying = page.getByTestId('flying-plane')
  const searchCard = page.getByRole('search')

  // At the top: plane waiting at the start, search card and panels hidden.
  await expect(main).toHaveAttribute('data-landed', 'false')
  await expect(page.getByText('Scroll to fly')).toBeVisible()
  await expect(searchCard).toHaveCSS('opacity', '0')
  const start = await flying.getAttribute('transform')

  // Without scrolling the plane stays put.
  await page.waitForTimeout(600)
  expect(await flying.getAttribute('transform')).toEqual(start)

  // Scrolling part way moves it along the route.
  await scrollThrough(page, 0.4)
  await expect.poll(() => flying.getAttribute('transform')).not.toEqual(start)
  await expect(main).toHaveAttribute('data-landed', 'false')

  // Scrolling to the end: flying plane gone, painted plane in, card and panels up.
  await scrollThrough(page, 1)
  await expect(main).toHaveAttribute('data-landed', 'true')
  await expect.poll(() => flying.getAttribute('opacity')).toBe('0.000')
  await expect(searchCard).toHaveCSS('opacity', '1')

  // Desktop layout: 1080 × 800 container (scaled as a whole on smaller
  // screens), picture 40px from the top, panel 20px from the left with its
  // bottom on the 780px mark. Phones are laid out separately for now.
  if ((page.viewportSize()?.width ?? 0) > 760) {
    const m = await page.evaluate(() => {
      const box = document.querySelector('section[aria-label="Introduction"]')!.querySelector('div > div') as HTMLElement
      const b = box.getBoundingClientRect()
      const art = box.querySelector('svg[role=img]')!.getBoundingClientRect()
      const card = box.querySelector('form')!.getBoundingClientRect()
      const s = b.height / 800
      return { ratio: b.width / b.height, top: (art.top - b.top) / s, artH: art.height / s, cardBottom: (card.bottom - b.top) / s, cardLeft: (card.left - b.left) / s }
    })
    expect(m.ratio).toBeCloseTo(1080 / 800, 2)
    expect(Math.round(m.top)).toBe(40)
    expect(Math.round(m.artH)).toBe(720)
    expect(Math.round(m.cardBottom)).toBe(780)
    expect(Math.round(m.cardLeft)).toBe(20)
  }

  // Scrolling back up flies it back.
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(main).toHaveAttribute('data-landed', 'false')
  await expect.poll(() => flying.getAttribute('transform')).toEqual(start)
  await expect(flying).toHaveAttribute('opacity', '1.000')

  // Past the picture, the page carries on to the two panels.
  await scrollThrough(page, 1)
  await page.getByRole('heading', { name: 'Where to?' }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('heading', { name: 'Where to?' })).toBeInViewport()
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
