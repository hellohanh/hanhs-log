import { test, expect } from '@playwright/test'
import { fakeSupabase } from './fake-supabase'

// Session 14: double-clicking a place in the left list opens its edit panel
// (computer; the single click still glides and opens the popup when there's
// a map — the test build has no map key, so here we check the double-click).
test.beforeEach(({}, info) => { test.skip(info.project.name === 'phone', 'computer lists only') })

const PIN = {
  id: 'pin-ben-thanh', trip_id: 'trip-saigon', google_place_id: 'g-bt', name: 'Bến Thành Market', address: null, lat: 10.772, lng: 106.698,
  category: 'shopping', subcategory: 'market', subsubcategory: null, michelin: null, michelin_year: null, street_food: false, fine_dining: false, note: null
}
const EATERY = {
  id: 'e1', google_place_id: 'gp1', name: 'Phở Hòa Pasteur', address: 'Quận 3', lat: 10.789, lng: 106.689, cuisine: 'vietnamese', dish: 'pho',
  michelin: null, michelin_year: null, street_food: false, fine_dining: false, price: 2, note: null, deleted_at: null
}

test('double-click a trip place opens its edit panel', async ({ page }) => {
  await fakeSupabase(page, { pins: [PIN] })
  await page.goto('./wander/trip/trip-saigon')
  const places = page.getByRole('complementary', { name: 'Places' })
  await places.getByRole('button', { name: /^Shopping,/ }).click()
  await places.getByRole('button', { name: /^Market,/ }).click()
  await places.getByText('Bến Thành Market').dblclick()
  await expect(places.getByRole('form', { name: 'Edit place' })).toBeVisible()
})

test('double-click a Munch List eatery opens its edit panel', async ({ page }) => {
  await fakeSupabase(page, { eateries: [EATERY] })
  await page.goto('./savor')
  const side = page.getByRole('complementary', { name: 'Catalogue' })
  await side.getByRole('button', { name: /^Vietnamese/ }).click()
  await side.getByRole('button', { name: /^Phở \d/ }).click()
  await side.getByText('Phở Hòa Pasteur').dblclick()
  await expect(side.getByRole('form', { name: 'Edit eatery' })).toBeVisible()
})
