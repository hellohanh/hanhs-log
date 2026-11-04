import { test, expect } from '@playwright/test'
import { fakeSupabase } from './fake-supabase'

// Galaxy Z Fold8 (session 18, Hanh): opened wide the inner screen is about
// 816 × 530–616 CSS px. A short touch screen gets the phone layout (full map,
// Places / Itinerary sheets) instead of a cramped computer one. The Itinerary
// sheet's day tabs stay put, only the timeline scrolls, and it opens at 6:00.

for (const [tag, width, height] of [['opened, browser bar', 816, 530], ['opened, home-screen app', 816, 616], ['cover screen', 416, 570]] as const) {
  test.describe(`Z Fold8 ${tag}`, () => {
    test.use({ viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
    test(`phone layout, Itinerary at 6:00 (${width} × ${height})`, async ({ page }, info) => {
      test.skip(info.project.name !== 'phone', 'one run is enough; the size is set here')
      await fakeSupabase(page)
      await page.goto('./wander/trip/trip-saigon')
      // Phone layout: the bottom bar and the Itinerary sheet, no side panels.
      await expect(page.getByRole('button', { name: 'Itinerary', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Open the itinerary' })).toHaveCount(0)
      const sheet = page.getByRole('region', { name: 'Itinerary' })
      await expect(sheet.getByRole('tab').first()).toBeVisible()
      const tl = sheet.locator('[data-scroll="timeline"]')
      await expect.poll(() => tl.evaluate(el => el.scrollTop)).toBe(6 * 60)
      // Only the timeline scrolls: the day tabs stay in view.
      await tl.evaluate(el => { el.scrollTop = 20 * 60 })
      await expect(sheet.getByRole('tab', { selected: true })).toBeInViewport()
    })
  })
}

test.describe('a laptop window as short as the Fold8 keeps the computer layout', () => {
  test.use({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false })
  test('no touch: computer layout', async ({ page }, info) => {
    test.skip(info.project.name !== 'phone')
    await fakeSupabase(page)
    await page.goto('./wander/trip/trip-saigon')
    await expect(page.getByRole('button', { name: 'Open the itinerary' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Itinerary' })).toHaveCount(0)
  })
})
