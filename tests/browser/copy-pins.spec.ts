import { test, expect } from '@playwright/test'
import { fakeSupabase, ME } from './fake-supabase'
import { copyCounts } from '../../src/lib/pinRules'

// Session 14: Copy pins — copy all pins from another trip you're on (0018);
// places already here are skipped; everyone's WTG / VIS comes along.

const pin = (id: string, trip: string, place: string | null, name: string) => ({
  id, trip_id: trip, google_place_id: place, name, address: null, lat: 35.67, lng: 139.7, category: 'attraction', subcategory: 'worship',
  subsubcategory: null, michelin: null, michelin_year: null, street_food: false, fine_dining: false, note: null
})
const PINS = [
  pin('j1', 'trip-undated', 'g-meiji', 'Meiji Shrine'),
  pin('j2', 'trip-undated', 'g-sensoji', 'Sensō-ji'),
  pin('j3', 'trip-undated', 'g-tower', 'Tokyo Tower'),
  pin('s1', 'trip-saigon', 'g-tower', 'Tokyo Tower')
]

test('copy counts skip places already here', () => {
  expect(copyCounts([{ google_place_id: 'a' }, { google_place_id: 'b' }, { google_place_id: null }], [{ google_place_id: 'b' }]))
    .toEqual({ total: 3, already: 1, toCopy: 2 })
})

test('Copy pins copies everything from another trip', async ({ page }, info) => {
  test.skip(info.project.name === 'phone', 'computer trip header; the phone has it in the ⋯ menu')
  const db = await fakeSupabase(page, { pins: PINS, reviews: [{ pin_id: 'j1', user_id: ME, status: 'vis', verdict: 'revisit', rating: 5, updated_at: '2026-10-01T00:00:00Z' }] })
  await page.goto('./wander/trip/trip-saigon')
  await page.getByRole('button', { name: 'Copy pins' }).click()
  const dlg = page.getByRole('dialog', { name: /Copy pins into Christmas in Saigon/ })
  await dlg.getByLabel('Copy from').selectOption({ label: 'Japan in spring' })
  await expect(dlg.getByText('3 pins · 2 to copy · 1 already here')).toBeVisible()
  await dlg.getByRole('button', { name: 'Copy all 2' }).click()
  await expect(dlg.getByRole('status')).toHaveText('✓ Copied 2 pins · 1 was already here')
  expect(db.pins.filter(p => p.trip_id === 'trip-saigon').map(p => p.name).sort()).toEqual(['Meiji Shrine', 'Sensō-ji', 'Tokyo Tower'])
  expect(db.reviews.some(r => r.pin_id === 'j1-copy' && r.rating === 5)).toBe(true)
  await dlg.getByRole('button', { name: 'Done' }).click()
  // The trip's Places list reloads with the copied pins.
  await expect(page.getByRole('complementary', { name: 'Places' }).getByRole('button', { name: /^Attraction,/ })).toBeVisible()
})
