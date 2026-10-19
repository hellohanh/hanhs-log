import { test, expect, type Page } from '@playwright/test'
import { fakeSupabase, ME } from './fake-supabase'

// Roaminglog on trips (session 14, steps 2–3): the non-food places are shared
// spots, shown on every trip next to the trip's own food pins. Editing, notes,
// WTG / VIS, removing and scheduling all go to the spot tables. (Desktop
// layout; the phone layout shares the same panels.)
test.beforeEach(({}, info) => { test.skip(info.project.name === 'phone', 'desktop trip layout') })

const MEIJI = { id: 'spot-meiji', google_place_id: 'g-meiji', name: 'Meiji Jingu', address: 'Shibuya', lat: 35.676, lng: 139.699, category: 'attraction', subcategory: 'worship', subsubcategory: null, note: 'Go early', created_at: '2026-10-01T00:00:00Z', deleted_at: null }
const MARKET = { id: 'spot-market', google_place_id: 'g-ben-thanh', name: 'Bến Thành Market', address: null, lat: 10.772, lng: 106.698, category: 'shopping', subcategory: 'market', subsubcategory: null, note: null, created_at: '2026-10-01T00:00:00Z', deleted_at: null }
const PHO = { id: 'pin-pho', trip_id: 'trip-saigon', google_place_id: 'g-pho', name: 'Phở Hòa Pasteur', address: null, lat: 10.789, lng: 106.689, category: 'food', subcategory: 'vietnamese', subsubcategory: 'pho', michelin: null, michelin_year: null, street_food: false, fine_dining: false, note: null }
// An old copy of the market still pinned on the trip (before the move runs): shown once.
const OLD_MARKET = { ...PHO, id: 'pin-old-market', google_place_id: 'g-ben-thanh', name: 'Ben Thanh (old)', category: 'shopping', subcategory: 'market', subsubcategory: null }

async function open(page: Page, opts: Parameters<typeof fakeSupabase>[1] = {}) {
  const db = await fakeSupabase(page, { pins: [PHO, OLD_MARKET], spots: [MEIJI, MARKET], ...opts })
  await page.goto('./wander/trip/trip-saigon')
  return { db, places: page.getByRole('complementary', { name: 'Places' }) }
}

test('spots show on the trip beside its food pins, once each, with their WTG / VIS', async ({ page }) => {
  const { places } = await open(page, {
    spotReviews: [{ spot_id: 'spot-meiji', user_id: ME, status: 'vis', verdict: 'revisit', rating: 5, updated_at: '2026-10-02T00:00:00Z' }]
  })
  await expect(places.getByRole('button', { name: /^Nom-Nom, 1 pin/ })).toBeVisible()
  await expect(places.getByRole('button', { name: /^Shopping, 1 pin/ })).toBeVisible()
  await places.getByRole('button', { name: /^Shopping,/ }).click()
  await places.getByRole('button', { name: /^Market,/ }).click()
  await expect(places.getByText('Bến Thành Market')).toBeVisible()
  await expect(places.getByText('Ben Thanh (old)')).toHaveCount(0)
  await places.getByRole('button', { name: /^Attraction,/ }).click()
  await places.getByRole('button', { name: /^Worship,/ }).click()
  await expect(places.getByRole('img', { name: 'Visited: revisit' })).toBeVisible()
})

test('editing a spot saves to Roaminglog; your WTG / VIS goes to spot reviews; remove goes to the owner', async ({ page }) => {
  const { db, places } = await open(page)
  await places.getByRole('button', { name: /^Shopping,/ }).click()
  await places.getByRole('button', { name: /^Market,/ }).click()
  await places.getByText('Bến Thành Market').click()
  const card = places.getByRole('form', { name: 'Edit place' })
  await card.getByLabel('Note').fill('Bargain hard')
  await card.getByRole('radio', { name: 'VIS' }).click()
  await card.getByRole('radio', { name: /Revisit/ }).click()
  await card.getByRole('button', { name: 'Save' }).click()
  await expect(places.getByRole('form')).toHaveCount(0)
  const patch = db.calls.find(c => c.method === 'PATCH' && c.path === '/rest/v1/spots')!
  expect(patch.url).toContain('id=eq.spot-market')
  expect(JSON.parse(patch.body!)).toMatchObject({ note: 'Bargain hard', category: 'shopping' })
  expect(JSON.parse(patch.body!).trip_id).toBeUndefined()
  expect(db.calls.some(c => c.method === 'PATCH' && c.path === '/rest/v1/pins')).toBe(false)
  expect(db.spotReviews).toEqual([expect.objectContaining({ spot_id: 'spot-market', user_id: ME, status: 'vis', verdict: 'revisit' })])

  await places.getByRole('button', { name: /^Shopping,/ }).click()
  await places.getByRole('button', { name: /^Market,/ }).click()
  await places.getByText('Bến Thành Market').click()
  await places.getByRole('button', { name: 'Delete' }).click()
  await expect(places.getByRole('alert')).toContainText('pending-deletion list')
  await places.getByRole('alert').getByRole('button', { name: 'Delete' }).click()
  await expect.poll(() => db.spots.find(s => s.id === 'spot-market')?.deleted_at).toBeTruthy()
  expect(db.calls.some(c => c.path === '/rest/v1/rpc/request_spot_deletion')).toBe(true)
  // The old trip copy now shows again (until the move clears it), so only check the spot left.
  await expect(places.getByText('Bến Thành Market')).toHaveCount(0)
})

test('a spot schedules onto a day as a spot', async ({ page }) => {
  const { db, places } = await open(page)
  await page.getByRole('button', { name: 'Open the itinerary', exact: true }).click()
  await page.getByRole('complementary', { name: 'Itinerary' }).getByRole('tab').first().click()
  await places.getByRole('button', { name: /^Shopping,/ }).click()
  await places.getByRole('button', { name: /^Market,/ }).click()
  await places.getByRole('button', { name: /Add Bến Thành Market to/ }).click()
  await expect.poll(() => db.stops.length).toBe(1)
  expect(db.stops[0]).toMatchObject({ spot_id: 'spot-market' })
  expect(db.stops[0].pin_id).toBeUndefined()
  // It shows as a block after a reload too.
  await page.reload()
  await page.getByRole('complementary', { name: 'Itinerary' }).getByRole('tab').first().click().catch(() => undefined)
  await expect(page.getByRole('button', { name: /Bến Thành Market, .* to / })).toBeVisible()
})
