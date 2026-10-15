import { test, expect, type Locator, type Page } from '@playwright/test'
import { fakeSupabase } from './fake-supabase'

// The desktop trip layout. On the phone size the trip page is the map with
// bottom sheets (session 10), covered in phone.spec.ts.
test.beforeEach(({}, info) => { test.skip(info.project.name === 'phone', 'desktop trip layout; phone layout in phone.spec.ts') })

// Connectors between a day's stops (M3 step 4): auto between consecutive
// places, tap the badge to set/clear the mode. Times/distances come live from
// Google (none in the test build → "no route"), so the caption format and the
// attach geometry are checked via lib helpers.

type R = Record<string, unknown>
const pin = (id: string, name: string, cat: string): R => ({ id, trip_id: 'trip-saigon', google_place_id: id, name, address: 'Q3', lat: 10.78, lng: 106.69, category: cat, subcategory: null, subsubcategory: null, michelin: null, michelin_year: null, street_food: false, fine_dining: false, note: null })

async function seed(page: Page, conns: R[] = []) {
  const db = await fakeSupabase(page, { pins: [pin('a', 'Phở Hòa Pasteur', 'food'), pin('b', 'Jade Emperor Pagoda', 'attraction'), pin('c', 'Anan Saigon', 'food')] })
  db.days.push({ id: 'day-1', trip_id: 'trip-saigon', date: '2026-12-19', note: null, created_at: 'x' })
  db.stops.push({ id: 's1', day_id: 'day-1', pin_id: 'a', start_time: '08:00', end_time: '09:00', note: null } as unknown as (typeof db.stops)[number])
  db.stops.push({ id: 's2', day_id: 'day-1', pin_id: 'b', start_time: '09:30', end_time: '10:30', note: null } as unknown as (typeof db.stops)[number])
  db.stops.push({ id: 's3', day_id: 'day-1', pin_id: 'c', start_time: '11:30', end_time: '13:00', note: null } as unknown as (typeof db.stops)[number])
  for (const c of conns) db.conns.push(c)
  return db
}

async function openDay(page: Page): Promise<Locator> {
  await page.goto('./wander/trip/trip-saigon')
  await page.getByRole('button', { name: 'Open the itinerary', exact: true }).click()
  const panel = page.getByRole('complementary', { name: 'Itinerary' })
  await panel.getByRole('tab', { name: /Dec 19/ }).click()
  await panel.getByText('Phở Hòa Pasteur').first().waitFor()
  return panel
}

test('a connector sits between each pair of consecutive stops; set and clear its mode', async ({ page }) => {
  const db = await seed(page)
  const panel = await openDay(page)
  // Two gaps → two unset connectors.
  const add = panel.getByRole('button', { name: 'Add travel between these places' })
  await expect(add).toHaveCount(2)

  // Tapping the badge opens the picker, not the "Add at …" activity popup.
  await add.first().click()
  await expect(panel.getByRole('dialog', { name: 'Pick a travel mode' })).toBeVisible()
  await expect(panel.getByRole('dialog', { name: /^Add at/ })).toHaveCount(0)

  await panel.getByRole('dialog', { name: 'Pick a travel mode' }).getByRole('radio', { name: 'Drive' }).click()
  // The first connector now shows Drive; one connector is still unset.
  await expect(panel.getByRole('button', { name: 'Travel: Drive. Change' })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Add travel between these places' })).toHaveCount(1)
  const post = db.calls.find(c => c.method === 'POST' && c.path === '/rest/v1/itinerary_connectors')!
  expect(JSON.parse(post.body!)).toMatchObject({ day_id: 'day-1', from_stop_id: 's1', to_stop_id: 's2', mode: 'drive' })

  // Reopen and remove it.
  await panel.getByRole('button', { name: 'Travel: Drive. Change' }).click()
  const picker = panel.getByRole('dialog', { name: 'Pick a travel mode' })
  await expect(picker.getByRole('radio', { name: 'Drive' })).toHaveAttribute('aria-checked', 'true')
  await picker.getByRole('button', { name: 'Remove' }).click()
  await expect(panel.getByRole('button', { name: 'Add travel between these places' })).toHaveCount(2)
  await expect.poll(() => db.conns.length).toBe(0)
})

test('an already-set connector loads with its mode', async ({ page }) => {
  await seed(page, [{ id: 'x1', day_id: 'day-1', from_stop_id: 's2', to_stop_id: 's3', mode: 'walk' }])
  const panel = await openDay(page)
  await expect(panel.getByRole('button', { name: 'Travel: Walk. Change' })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Add travel between these places' })).toHaveCount(1)
})

test('connector helpers: attach geometry and time/distance formatting', async () => {
  const { connectorGeometry, HOUR_PX } = await import('../../src/lib/itineraryLayout')
  const { formatMinutes, formatMeters } = await import('../../src/lib/itineraryLayout')
  // Three stops: first at 50% out, middle at 42% in / 58% out, last at 50% in.
  const stops = [
    { start_time: '08:00', end_time: '09:00' }, // top 0, h 60
    { start_time: '09:00', end_time: '10:00' }, // top 60, h 60 (back to back)
    { start_time: '10:00', end_time: '11:00' } // top 120, h 60
  ]
  expect(HOUR_PX).toBe(60)
  // Absolute timeline coords: 08:00 is 480px from midnight.
  // C0: first stop out 50% (480+30=510) → middle in 42% (540+25.2=565.2)
  const c0 = connectorGeometry(stops, 0)
  expect(c0.yU).toBeCloseTo(510)
  expect(c0.yL).toBeCloseTo(565.2)
  // C1: middle out 58% (540+34.8=574.8) → last in 50% (600+30=630)
  const c1 = connectorGeometry(stops, 1)
  expect(c1.yU).toBeCloseTo(574.8)
  expect(c1.yL).toBeCloseTo(630)

  expect(formatMinutes(12)).toBe('12 min')
  expect(formatMinutes(75)).toBe('1 h 15 min')
  expect(formatMinutes(120)).toBe('2 h')
  expect(formatMeters(850)).toBe('850 m')
  expect(formatMeters(3160)).toBe('3.2 km')
})
