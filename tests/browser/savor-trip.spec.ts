import { test, expect } from '@playwright/test'
import { fakeSupabase } from './fake-supabase'

// Savorlog on trips (M5.2/5.3): a trip shows the catalogue's eateries (by city)
// in a Nom-Nom section, and picking the Nom-Nom category while adding a place
// hands off to the full Savorlog add panel (saving to the shared catalogue).

const EATERY = {
  id: 'e1', google_place_id: 'gp1', name: 'Phở Hòa Pasteur', address: 'Quận 3', lat: 10.789, lng: 106.689,
  cuisine: 'vietnamese', dish: 'pho', michelin: 'mentioned', michelin_year: 2025, street_food: true, fine_dining: false, price: 2, note: null, deleted_at: null
}

test('the trip Places panel shows catalogue eateries from Savorlog', async ({ page }) => {
  await fakeSupabase(page, { eateries: [EATERY] })
  await page.goto('./wander/trip/trip-saigon')
  const places = page.getByRole('complementary', { name: 'Places' })
  await expect(places.getByText('Nom-Nom')).toBeVisible()
  await expect(places.getByText('from Savorlog')).toBeVisible()
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
