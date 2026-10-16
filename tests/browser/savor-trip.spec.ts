import { test, expect } from '@playwright/test'
import { fakeSupabase } from './fake-supabase'

// The desktop trip layout. On the phone size the trip page is the map with
// bottom sheets (session 10), covered in phone.spec.ts.
test.beforeEach(({}, info) => { test.skip(info.project.name === 'phone', 'desktop trip layout; phone layout in phone.spec.ts') })

// Savorlog on trips (M5.2/5.3): a trip shows the catalogue's eateries (by city)
// in a Nom-Nom section, and picking the Nom-Nom category while adding a place
// hands off to the full Savorlog add panel (saving to the shared catalogue).

const EATERY = {
  id: 'e1', google_place_id: 'gp1', name: 'Phở Hòa Pasteur', address: 'Quận 3', lat: 10.789, lng: 106.689,
  cuisine: 'vietnamese', dish: 'pho', michelin: 'mentioned', michelin_year: 2025, street_food: true, fine_dining: false, price: 2, note: null, deleted_at: null
}

test('the trip Places panel shows catalogue eateries from Savorlog', async ({ page }) => {
  const pin = (id: string, name: string, category: string) =>
    ({ id, trip_id: 'trip-saigon', google_place_id: `g-${id}`, name, address: null, lat: 10.77, lng: 106.69, category, subcategory: null, subsubcategory: null, michelin: null, michelin_year: null, street_food: false, fine_dining: false, note: null })
  await fakeSupabase(page, { eateries: [EATERY], pins: [pin('s1', 'Bến Thành Market', 'shopping'), pin('a1', 'Tân Sơn Nhất', 'airport')] })
  await page.goto('./wander/trip/trip-saigon')
  const places = page.getByRole('complementary', { name: 'Places' })
  // Nom-Nom is a category like the others, in A–Z order, with no "from Savorlog" chip (session 10).
  await expect(places.getByRole('button', { name: /, \d+ pins?$/ })).toHaveText([/Airport/, /Nom-Nom/, /Shopping/])
  await expect(places.getByText('from Savorlog')).toHaveCount(0)
  await places.getByRole('button', { name: /^Nom-Nom, 1 pin/ }).click()
  await places.getByRole('button', { name: /^Vietnamese/ }).click()
  await places.getByRole('button', { name: /^Phở/ }).click()
  await places.getByRole('button', { name: /Phở Hòa Pasteur/ }).first().click()
  // Opening an eatery on the trip uses the Savorlog edit panel.
  await expect(places.getByRole('form', { name: 'Edit eatery' })).toBeVisible()
})

test('picking Nom-Nom while adding on a trip opens the full Savorlog add panel', async ({ page }) => {
  const db = await fakeSupabase(page, { eateries: [] })
  await page.route('https://places.googleapis.com/**', route => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: { photos: [] } })
    return route.fulfill({ json: { places: [{ id: 'gp-new', displayName: { text: 'Phở Lệ' }, formattedAddress: 'Quận 10', location: { latitude: 10.77, longitude: 106.67 } }] } })
  })
  await page.goto('./wander/trip/trip-saigon')
  const places = page.getByRole('complementary', { name: 'Places' })
  await places.getByRole('searchbox', { name: /Search Google/ }).fill('pho')
  await places.getByRole('button', { name: 'Search' }).click()
  await places.getByRole('button', { name: /Phở Lệ/ }).click()

  // The trip add card (a pin) is up; choosing the food category hands off.
  const pinForm = places.getByRole('form', { name: 'Add a place' })
  await expect(pinForm).toBeVisible()
  await pinForm.getByLabel('Category').selectOption('food')

  // The full Savorlog add panel appears, with its price chips etc.
  const savor = places.getByRole('form', { name: 'Add an eatery' })
  await expect(savor).toBeVisible()
  await expect(savor.getByRole('radio', { name: '2 of 4' })).toBeVisible() // price $$
  await savor.getByLabel('Cuisine (country)').selectOption({ label: 'Vietnamese' })
  await savor.getByRole('radio', { name: '2 of 4' }).click()
  await savor.getByRole('button', { name: 'Add eatery' }).click()

  // It saved to the shared catalogue (not a trip pin).
  await expect.poll(() => db.eateries.length).toBe(1)
  expect(db.eateries[0]).toMatchObject({ name: 'Phở Lệ', cuisine: 'vietnamese', price: 2 })
  expect(db.pins.filter(p => (p as { category?: string }).category === 'food')).toHaveLength(0)
})

test('a catalogue eatery can be scheduled onto an itinerary day (M5.4)', async ({ page }) => {
  const db = await fakeSupabase(page, { eateries: [EATERY] })
  await page.goto('./wander/trip/trip-saigon')
  // Open the itinerary and pick the first day so "Add to day" is enabled.
  await page.getByRole('button', { name: 'Open the itinerary', exact: true }).click()
  const panel = page.getByRole('complementary', { name: 'Itinerary' })
  await panel.getByRole('tab').first().click()

  // Expand the Nom-Nom tree and add the eatery to the open day.
  const places = page.getByRole('complementary', { name: 'Places' })
  await places.getByRole('button', { name: /^Nom-Nom,/ }).click()
  await places.getByRole('button', { name: /^Vietnamese/ }).click()
  await places.getByRole('button', { name: /^Phở/ }).click()
  const add = places.getByRole('button', { name: /Add Phở Hòa Pasteur to/ })
  await expect(add).toBeEnabled()
  await add.click()

  // It shows as a time block on the day, and the stop carries the eatery (not a pin).
  await expect(panel.getByRole('button', { name: /Phở Hòa Pasteur, .* to / })).toBeVisible()
  await expect.poll(() => db.stops.length).toBe(1)
  const st = db.stops[0] as unknown as { pin_id: string | null; eatery_id: string | null }
  expect(st.eatery_id).toBe('e1')
  expect(st.pin_id ?? null).toBeNull()
})

// Session 13 (E101): a trip shows the whole catalogue, not just its cities.
// The test build has no map key, so the list shows everything; the on-screen
// filter itself is checked in the helper test below.
const FAR = {
  ...EATERY, id: 'e9', google_place_id: 'gp9', name: 'Sushi Saito', address: 'Tokyo', lat: 35.67, lng: 139.74,
  cuisine: 'japanese', dish: null, michelin: null, michelin_year: null, street_food: false
}

test('a Saigon trip shows a far eatery from the catalogue too (session 13)', async ({ page }) => {
  await fakeSupabase(page, { eateries: [EATERY, FAR] })
  await page.goto('./wander/trip/trip-saigon')
  const places = page.getByRole('complementary', { name: 'Places' })
  await places.getByRole('button', { name: /^Nom-Nom, 2 pins/ }).click()
  await expect(places.getByRole('button', { name: /^Japanese/ })).toBeVisible()
  await expect(places.getByRole('button', { name: /^Vietnamese/ })).toBeVisible()
})

test('the Nom-Nom list follows the map view (session 13)', async () => {
  const { onScreen } = await import('../../src/lib/countryBounds')
  const all = [EATERY, FAR]
  const saigonView = { south: 10.6, west: 106.5, north: 10.95, east: 106.9 }
  const tokyoView = { south: 35.5, west: 139.5, north: 35.9, east: 140 }
  const asia = { south: 0, west: 95, north: 45, east: 150 }
  expect(onScreen(all, saigonView, true).map(e => e.id)).toEqual(['e1'])
  expect(onScreen(all, tokyoView, true).map(e => e.id)).toEqual(['e9'])
  expect(onScreen(all, asia, true)).toHaveLength(2)
  // Before the map reports a view: nothing; with no map at all: everything.
  expect(onScreen(all, null, true)).toHaveLength(0)
  expect(onScreen(all, null, false)).toHaveLength(2)
})
