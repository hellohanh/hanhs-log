import { test, expect } from '@playwright/test'
import { fakeSupabase, ME } from './fake-supabase'

// Savorlog page (M4 step 4c): the shared eatery catalogue by country → dish on
// the left, the whole catalogue on one map. The map itself needs Google, so
// here we check the catalogue panel: grouping, collapse, filters and the peek.

const EATERIES = [
  { id: 'e1', google_place_id: 'gp1', name: 'Phở Hòa Pasteur', address: 'Quận 3', lat: 10.789, lng: 106.689, cuisine: 'vietnamese', dish: 'pho', michelin: 'mentioned', michelin_year: 2025, street_food: true, fine_dining: false, price: 2, note: 'Go before 9am', deleted_at: null },
  { id: 'e2', google_place_id: 'gp2', name: 'Anan Saigon', address: 'Quận 1', lat: 10.77, lng: 106.70, cuisine: 'vietnamese', dish: null, michelin: '1', michelin_year: 2025, street_food: false, fine_dining: true, price: 4, note: null, deleted_at: null },
  { id: 'e3', google_place_id: 'gp3', name: 'Sushi Saito', address: 'Tokyo', lat: 35.67, lng: 139.74, cuisine: 'japanese', dish: null, michelin: null, michelin_year: null, street_food: false, fine_dining: false, price: 4, note: null, deleted_at: null }
]
const REVIEWS = [{ eatery_id: 'e1', user_id: ME, status: 'vis', verdict: 'revisit', rating: 4.5, updated_at: '2026-10-01T00:00:00Z' }]

test('groups the catalogue by country → dish, collapsed, and opens an eatery', async ({ page }) => {
  await fakeSupabase(page, { eateries: EATERIES, eateryReviews: REVIEWS })
  await page.goto('./savor')
  const side = page.getByRole('complementary', { name: 'Catalogue' })
  await expect(side.getByText('3', { exact: true }).first()).toBeVisible()

  // Country nodes show; eatery rows are hidden until expanded (E30).
  await expect(side.getByRole('button', { name: /Vietnamese/ })).toBeVisible()
  await expect(side.getByRole('button', { name: /Japanese/ })).toBeVisible()
  await expect(side.getByRole('button', { name: /Phở Hòa Pasteur/ })).toHaveCount(0)

  // Expand Vietnamese: a loose eatery (no dish) and a Phở dish node appear.
  await side.getByRole('button', { name: /Vietnamese/ }).click()
  await expect(side.getByRole('button', { name: /Anan Saigon/ })).toBeVisible()
  await expect(side.getByRole('button', { name: /^Phở/ })).toBeVisible()
  await expect(side.getByRole('button', { name: /Phở Hòa Pasteur/ })).toHaveCount(0)

  // Expand the dish: its eatery appears.
  await side.getByRole('button', { name: /^Phở/ }).click()
  await side.getByRole('button', { name: /Phở Hòa Pasteur/ }).click()

  // The read-only peek opens with the eatery's path and MICHELIN.
  await expect(side.getByText('Phở Hòa Pasteur')).toBeVisible()
  await expect(side.getByText(/Vietnamese › Phở/)).toBeVisible()
  await expect(side.getByText(/Average rating 4.5/)).toBeVisible()
})

test('the MICHELIN chip counts only MICHELIN eateries', async ({ page }) => {
  await fakeSupabase(page, { eateries: EATERIES, eateryReviews: REVIEWS })
  await page.goto('./savor')
  const side = page.getByRole('complementary', { name: 'Catalogue' })
  await expect(side.getByRole('button', { name: /MICHELIN 2/ })).toBeVisible()
})

test('an empty catalogue says so', async ({ page }) => {
  await fakeSupabase(page, { eateries: [], eateryReviews: [] })
  await page.goto('./savor')
  await expect(page.getByText('No eateries yet. Adding comes in the next step.')).toBeVisible()
})

test('country → dish tree helper', async () => {
  const { buildCountryTree } = await import('../../src/lib/savorTree')
  const tree = buildCountryTree(EATERIES.map(e => ({ cuisine: e.cuisine, dish: e.dish, id: e.id })))
  expect(tree.map(c => c.key)).toEqual(['vietnamese', 'japanese'])
  const vn = tree[0]
  expect(vn.count).toBe(2)
  expect(vn.loose.map(e => e.id)).toEqual(['e2']) // Anan has no dish → under the country
  expect(vn.dishes.map(d => d.key)).toEqual(['pho'])
  expect(vn.dishes[0].eateries.map(e => e.id)).toEqual(['e1'])
  // Japanese has no catalogue dishes yet, so its eatery sits loose.
  expect(tree[1].loose.map(e => e.id)).toEqual(['e3'])
})
