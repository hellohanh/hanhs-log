import { test, expect, type Page } from '@playwright/test'
import { fakeSupabase, ME, type FakeDb, type FakeTrip } from './fake-supabase'
import { arrivesInCity } from '../../src/lib/place'

// Session 20 (Hanh): an overnight leg on one trip that arrives on a day of
// another of your trips, in that trip's city (the "next leg"), shows there
// from 00:00 to the arrival, read only, "Continues from: <trip>". The day
// opens scrolled up so the block shows.

const trip = (id: string, name: string, city: string, start: string, end: string): FakeTrip => ({
  id, name, country: 'Vietnam', city_primary: city, city_secondary: null, city_tertiary: null,
  start_date: start, end_date: end, owner_id: ME, created_at: '2026-07-01T00:00:00Z', invite_token: `tok-${id}`, pins: [{ count: 0 }]
})
const TRIPS = [
  trip('t-hcmc', 'Saigon in December', 'Hồ Chí Minh City', '2026-12-17', '2026-12-21'),
  trip('t-nt', 'Nha Trang beach days', 'Nha Trang', '2026-12-22', '2026-12-25'),
  trip('t-hn', 'Hà Nội too', 'Hà Nội', '2026-12-22', '2026-12-24')
]
const TRAIN = {
  mode: 'train', title: 'HCMC to Nha Trang; Premium Train Experience', carrier: 'DaNang Smile Tour', reference: 'GYGN6BRGN8N4',
  from_location: '1 Nguyễn Thông, Nhiêu Lộc, Hồ Chí Minh', from_date: '2026-12-21', from_time: '21:15:00', from_timezone: null,
  to_location: 'Nha Trang', to_date: '2026-12-22', to_time: '05:45:00', to_timezone: null, note: null
}

function seed(db: FakeDb) {
  db.days.push({ id: 'hcmc-21', trip_id: 't-hcmc', date: '2026-12-21', note: null, created_at: 'x' })
  for (const d of ['22', '23', '24', '25']) db.days.push({ id: `nt-${d}`, trip_id: 't-nt', date: `2026-12-${d}`, note: null, created_at: 'x' })
  for (const d of ['22', '23', '24']) db.days.push({ id: `hn-${d}`, trip_id: 't-hn', date: `2026-12-${d}`, note: null, created_at: 'x' })
  db.legs.push({ id: 'leg-train', day_id: 'hcmc-21', ...TRAIN })
}
async function openFirstDay(page: Page) {
  await page.getByRole('button', { name: 'Open the itinerary', exact: true }).click()
  const panel = page.getByRole('complementary', { name: 'Itinerary' })
  await panel.getByRole('tab').first().click()
  return panel
}
test.beforeEach(({}, info) => { test.skip(info.project.name === 'phone', 'computer itinerary panel; phones share the same panel code') })

test('the overnight train shows 00:00–05:45 on the next trip, read only', async ({ page }) => {
  seed(await fakeSupabase(page, { trips: TRIPS }))
  await page.goto('./wander/trip/t-nt')
  const panel = await openFirstDay(page)
  const block = panel.getByRole('button', { name: /HCMC to Nha Trang/ })
  await expect(block).toBeVisible()
  await expect(panel.getByText('Continues from: Saigon in December')).toBeVisible()
  // The day opened scrolled to the top, where the 00:00 block is.
  await expect.poll(() => panel.locator('[data-scroll="timeline"]').evaluate(el => el.scrollTop)).toBe(0)
  // Read only: opens the overnight card, not the edit form.
  await block.click()
  await expect(page.getByRole('dialog', { name: 'Overnight travel' })).toContainText('Overnight from Saigon in December. Edit or delete it there.')
  await expect(page.getByText('Edit travel')).toHaveCount(0)
})

test('a trip on the same dates in another city does not get it', async ({ page }) => {
  seed(await fakeSupabase(page, { trips: TRIPS }))
  await page.goto('./wander/trip/t-hn')
  const panel = await openFirstDay(page)
  await expect(panel.getByTestId('day-timeline')).toBeVisible()
  await expect(panel.getByRole('button', { name: /HCMC to Nha Trang/ })).toHaveCount(0)
  // A normal day still opens at 6:00.
  await expect.poll(() => panel.locator('[data-scroll="timeline"]').evaluate(el => el.scrollTop)).toBeGreaterThan(0)
})

test('city match ignores accents, case and extra words', ({}, info) => {
  test.skip(info.project.name !== 'laptop', 'pure helper test')

  expect(arrivesInCity('Nha Trang', ['Nha Trang'])).toBe(true)
  expect(arrivesInCity('Ga Nha Trang, Khánh Hòa', ['nha trang'])).toBe(true)
  expect(arrivesInCity('Hà Nội Station', ['Ha Noi'])).toBe(true)
  expect(arrivesInCity('Đà Nẵng', [null, 'Da Nang'])).toBe(true)
  expect(arrivesInCity('Nha Trang', ['Hồ Chí Minh City', null])).toBe(false)
  expect(arrivesInCity('Nha Trang', [])).toBe(false)
})
