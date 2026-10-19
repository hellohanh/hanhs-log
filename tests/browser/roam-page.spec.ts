import { test, expect } from '@playwright/test'
import { fakeSupabase, fakePlaces, ME } from './fake-supabase'

// Roaminglog's Spot List (/roam, session 14 step 4): the shared spot catalogue
// as a tree, add from Google, edit, WTG / VIS and remove-to-the-owner. Without
// a map key (test builds) the list shows every spot and a row opens its card.

const MEIJI = { id: 'spot-meiji', google_place_id: 'g-meiji', name: 'Meiji Jingu', address: 'Shibuya', lat: 35.676, lng: 139.699, category: 'attraction', subcategory: 'worship', subsubcategory: null, note: 'Go early', created_at: '2026-10-01T00:00:00Z', deleted_at: null }
const HND = { id: 'spot-hnd', google_place_id: 'g-hnd', name: 'Haneda Airport', address: 'Tokyo', lat: 35.549, lng: 139.779, category: 'airport', subcategory: null, subsubcategory: null, note: null, created_at: '2026-10-01T00:00:00Z', deleted_at: null }
const NEW = { id: 'g-tower', name: 'Tokyo Tower', address: 'Minato City, Tokyo', lat: 35.6586, lng: 139.7454 }

test('the Spot List: header link, tree of spots, add, edit and remove', async ({ page }, info) => {
  const db = await fakeSupabase(page, {
    spots: [MEIJI, HND],
    spotReviews: [{ spot_id: 'spot-meiji', user_id: ME, status: 'vis', verdict: 'revisit', rating: 5, updated_at: '2026-10-02T00:00:00Z' }]
  })
  await fakePlaces(page, [NEW])
  await page.goto('./')
  if (info.project.name === 'phone') await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await page.getByRole('link', { name: 'Roaminglog' }).first().click()
  await expect(page).toHaveURL(/\/roam$/)
  await expect(page.getByRole('heading', { name: 'Spot List' })).toBeVisible()

  if (info.project.name === 'phone') await page.getByRole('button', { name: /Spots/ }).first().click().catch(() => undefined)
  const list = info.project.name === 'phone' ? page : page.getByRole('complementary', { name: 'Spots' })
  await expect(list.getByRole('button', { name: /^Airport, 1 pin/ })).toBeVisible()
  await list.getByRole('button', { name: /^Attraction,/ }).click()
  await list.getByRole('button', { name: /^Worship,/ }).click()
  await expect(list.getByRole('img', { name: 'Visited: revisit' })).toBeVisible()
  // No itinerary here, so no "+ Add to a day".
  await expect(list.getByRole('button', { name: /Add to a day|Add Meiji/ })).toHaveCount(0)

  if (info.project.name === 'phone') return // phone: the search sheet and form are the same components

  // Edit (no map → a row opens the card): no food category, no Add to a day.
  await list.getByText('Meiji Jingu').click()
  const card = list.getByRole('form', { name: 'Edit place' })
  await expect(card.getByLabel('Category').locator('option', { hasText: 'Nom-Nom' })).toHaveCount(0)
  await expect(card.getByRole('button', { name: /Add to/ })).toHaveCount(0)
  await card.getByLabel('Note').fill('Go early\nQuiet at 8')
  await card.getByRole('button', { name: 'Save' }).click()
  await expect.poll(() => db.spots.find(s => s.id === 'spot-meiji')?.note).toBe('Go early\nQuiet at 8')

  // Add from Google.
  await list.getByRole('searchbox', { name: 'Search Google for a spot to add' }).fill('tokyo tower')
  await list.getByRole('button', { name: 'Search' }).click()
  await list.getByRole('button', { name: /Tokyo Tower/ }).click()
  const add = list.getByRole('form', { name: 'Add a place' })
  await add.getByLabel('Category').selectOption('attraction')
  await add.getByRole('button', { name: 'Add pin' }).click()
  await expect.poll(() => db.spots.map(s => s.name)).toContain('Tokyo Tower')
  expect(db.calls.some(c => c.method === 'POST' && c.path === '/rest/v1/pins')).toBe(false)

  // Remove goes to the owner's list.
  await list.getByRole('button', { name: /^Airport,/ }).click()
  await list.getByText('Haneda Airport').click()
  await list.getByRole('button', { name: 'Delete' }).click()
  await expect(list.getByRole('alert')).toContainText('pending-deletion list')
  await list.getByRole('alert').getByRole('button', { name: 'Delete' }).click()
  await expect.poll(() => db.spots.find(s => s.id === 'spot-hnd')?.deleted_at).toBeTruthy()
  await expect(list.getByText('Haneda Airport')).toHaveCount(0)
})

test('the splash has a third card for Roaminglog', async ({ page }) => {
  await page.goto('./')
  const card = page.getByRole('link', { name: /Roaminglog.*Keep the spots/ })
  await expect(card).toHaveAttribute('href', /\/roam$/)
  await expect(card.locator('img')).toHaveAttribute('src', /card-roam\.webp$/)
})
