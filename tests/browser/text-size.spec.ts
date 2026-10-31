import { test, expect, type Locator } from '@playwright/test'
import { fakeSupabase } from './fake-supabase'

// Text size chip on the itinerary (session 17, modelled on the TNCFL tracker):
// − | reset | + just before the lock; block text only, 2 px steps from 9 to
// 21, default 13; back to the default on each visit (not remembered).

const px = (l: Locator) => l.evaluate(el => parseFloat(getComputedStyle(el).fontSize))

test('itinerary text size: − / reset / + change the block text only, 9 to 21, default each visit', async ({ page }, info) => {
  const db = await fakeSupabase(page)
  const phone = info.project.name === 'phone'
  const open = async () => {
    await page.goto('./wander/trip/trip-saigon')
    if (phone) return
    // The panel may still be open from the last visit.
    const opener = page.getByRole('button', { name: 'Open the itinerary' })
    await expect(opener.or(page.getByRole('complementary', { name: 'Itinerary' })).first()).toBeVisible()
    if (await opener.isVisible()) await opener.click()
  }
  await open()
  const panel = phone ? page.getByRole('region', { name: 'Itinerary' }) : page.getByRole('complementary', { name: 'Itinerary' })
  await expect(panel.getByRole('tab').first()).toBeVisible()
  const dayId = (await expect.poll(() => db.days.length).toBeGreaterThan(0), db.days[0].id)
  db.acts.push({ id: 'act-1', day_id: dayId, title: 'Coffee at Cộng', start_time: '09:00', end_time: '10:00', note: 'Coconut coffee' })
  await open()
  const chip = panel.getByRole('group', { name: /Text size/ })
  await expect(chip).toBeVisible()
  // The chip sits just before the lock.
  const next = await chip.evaluate(el => el.nextElementSibling?.getAttribute('aria-label') ?? '')
  expect(next).toMatch(/lock/i)

  const title = panel.getByRole('button', { name: /Coffee at Cộng/ }).locator('b')
  const hour = panel.getByTestId('day-timeline').getByText('9:00', { exact: true })
  const smaller = chip.getByRole('button', { name: 'Smaller text' })
  const larger = chip.getByRole('button', { name: 'Larger text' })
  const reset = chip.getByRole('button', { name: 'Reset text size' })
  await expect.poll(() => px(title)).toBe(13)
  await expect(reset).toBeDisabled()
  const hourBefore = await px(hour)

  await larger.click()
  await larger.click()
  await expect.poll(() => px(title)).toBe(17)
  expect(await px(hour)).toBe(hourBefore) // hour labels stay
  await expect(reset).toBeEnabled()
  await reset.click()
  await expect.poll(() => px(title)).toBe(13)

  for (let i = 0; i < 2; i++) await smaller.click()
  await expect.poll(() => px(title)).toBe(9)
  await expect(smaller).toBeDisabled()
  for (let i = 0; i < 6; i++) await larger.click()
  await expect.poll(() => px(title)).toBe(21)
  await expect(larger).toBeDisabled()

  // Not remembered: a new visit starts at 13.
  await open()
  await expect.poll(() => px(panel.getByRole('button', { name: /Coffee at Cộng/ }).locator('b'))).toBe(13)
})
