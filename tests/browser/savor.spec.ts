import { test, expect, type Page } from '@playwright/test'
import { fakeSupabase, ME } from './fake-supabase'

// Savorlog page (M4 step 4c): a required location gate scopes the page to a
// country or city, then the catalogue by country → dish on the left and the
// place on the map. The map needs Google; here we check the gate, the filter,
// the grouping and the peek.

const EATERIES = [
  { id: 'e1', google_place_id: 'gp1', name: 'Phở Hòa Pasteur', address: 'Quận 3', lat: 10.789, lng: 106.689, cuisine: 'vietnamese', dish: 'pho', michelin: 'mentioned', michelin_year: 2025, street_food: true, fine_dining: false, price: 2, note: 'Go before 9am', deleted_at: null },
  { id: 'e2', google_place_id: 'gp2', name: 'Anan Saigon', address: 'Quận 1', lat: 10.77, lng: 106.70, cuisine: 'vietnamese', dish: null, michelin: '1', michelin_year: 2025, street_food: false, fine_dining: true, price: 4, note: null, deleted_at: null },
  { id: 'e3', google_place_id: 'gp3', name: 'Sushi Saito', address: 'Tokyo', lat: 35.67, lng: 139.74, cuisine: 'japanese', dish: null, michelin: null, michelin_year: null, street_food: false, fine_dining: false, price: 4, note: null, deleted_at: null }
]
const REVIEWS = [{ eatery_id: 'e1', user_id: ME, status: 'vis', verdict: 'revisit', rating: 4.5, updated_at: '2026-10-01T00:00:00Z' }]

// Stub the location search (Google Places) with a few countries and a city.
const CANNED = [
  { id: 'c-vn', displayName: { text: 'Vietnam' }, formattedAddress: 'Vietnam', location: { latitude: 16, longitude: 106 }, types: ['country'], viewport: { low: { latitude: 8.2, longitude: 102 }, high: { latitude: 23.4, longitude: 109.6 } } },
  { id: 'c-jp', displayName: { text: 'Japan' }, formattedAddress: 'Japan', location: { latitude: 36, longitude: 138 }, types: ['country'], viewport: { low: { latitude: 30.9, longitude: 129.4 }, high: { latitude: 45.6, longitude: 146 } } },
  { id: 'c-it', displayName: { text: 'Italy' }, formattedAddress: 'Italy', location: { latitude: 42, longitude: 12 }, types: ['country'], viewport: { low: { latitude: 36.6, longitude: 6.6 }, high: { latitude: 47.1, longitude: 18.6 } } },
  { id: 'city-tok', displayName: { text: 'Tokyo' }, formattedAddress: 'Japan', location: { latitude: 35.68, longitude: 139.76 }, types: ['locality'] }
]
async function fakeLocationSearch(page: Page) {
  await page.route('https://places.googleapis.com/**', route => {
    const q = (JSON.parse(route.request().postData() || '{}').textQuery || '').toLowerCase()
    const places = CANNED.filter(p => (p.displayName.text.toLowerCase() + ' ' + p.formattedAddress.toLowerCase()).includes(q))
    return route.fulfill({ json: { places } })
  })
}

async function choose(page: Page, type: string, name: RegExp) {
  const dialog = page.getByRole('dialog', { name: 'Where to see eateries' })
  await dialog.getByRole('searchbox').fill(type)
  await dialog.getByRole('button', { name }).click()
}

test('the location gate is required, then filters the catalogue to that country', async ({ page }) => {
  await fakeSupabase(page, { eateries: EATERIES, eateryReviews: REVIEWS })
  await fakeLocationSearch(page)
  await page.goto('./savor')

  // The popup is up and the catalogue isn't shown yet.
  await expect(page.getByRole('dialog', { name: 'Where to see eateries' })).toBeVisible()
  const side = page.getByRole('complementary', { name: 'Catalogue' })
  await expect(side.getByRole('button', { name: /Vietnamese/ })).toHaveCount(0)

  await choose(page, 'viet', /Vietnam/)

  // Vietnam shows only its eateries (Tokyo's is filtered out), grouped by cuisine.
  await expect(page.getByText(/Showing/)).toContainText('Vietnam')
  await expect(side.getByRole('button', { name: /Vietnamese/ })).toBeVisible()
  await expect(side.getByText('2', { exact: true }).first()).toBeVisible()
  await side.getByRole('button', { name: /Vietnamese/ }).click()
  await expect(side.getByRole('button', { name: /Anan Saigon/ })).toBeVisible()
  await side.getByRole('button', { name: /^Phở/ }).click()
  await side.getByRole('button', { name: /Phở Hòa Pasteur/ }).click()
  await expect(side.getByText(/Vietnamese › Phở/)).toBeVisible()
})

test('a country with no eateries says so, and Change reopens the gate', async ({ page }) => {
  await fakeSupabase(page, { eateries: EATERIES, eateryReviews: REVIEWS })
  await fakeLocationSearch(page)
  await page.goto('./savor')
  await choose(page, 'italy', /Italy/)
  await expect(page.getByText('No eateries in Italy yet.')).toBeVisible()
  await page.getByRole('button', { name: 'Change' }).click()
  await expect(page.getByRole('dialog', { name: 'Where to see eateries' })).toBeVisible()
  await choose(page, 'japan', /^Japan/)
  await expect(page.getByText(/Showing/)).toContainText('Japan')
  await expect(page.getByRole('complementary', { name: 'Catalogue' }).getByRole('button', { name: /Japanese/ })).toBeVisible()
})

test('a city scopes to within its radius', async ({ page }) => {
  await fakeSupabase(page, { eateries: EATERIES, eateryReviews: REVIEWS })
  await fakeLocationSearch(page)
  await page.goto('./savor')
  await choose(page, 'tokyo', /Tokyo/)
  await expect(page.getByText(/Showing/)).toContainText('(city)')
  const side = page.getByRole('complementary', { name: 'Catalogue' })
  await side.getByRole('button', { name: /Japanese/ }).click()
  await expect(side.getByRole('button', { name: /Sushi Saito/ })).toBeVisible()
})

test('country → dish tree helper', async () => {
  const { buildCountryTree } = await import('../../src/lib/savorTree')
  const tree = buildCountryTree(EATERIES.map(e => ({ cuisine: e.cuisine, dish: e.dish, id: e.id })))
  expect(tree.map(c => c.key)).toEqual(['vietnamese', 'japanese'])
  expect(tree[0].loose.map(e => e.id)).toEqual(['e2'])
  expect(tree[0].dishes.map(d => d.key)).toEqual(['pho'])
})

test('scope resolution and membership', async () => {
  const { resolveScope, inScope } = await import('../../src/lib/savorLocation')
  const vn = resolveScope({ id: 'c-vn', name: 'Vietnam', sub: null, kind: 'country', lat: 16, lng: 106 })
  expect(vn.kind).toBe('country')
  expect(vn.bounds).toBeTruthy() // from the maintained mainland list
  expect(inScope({ lat: 10.78, lng: 106.69 }, vn)).toBe(true) // Saigon
  expect(inScope({ lat: 35.67, lng: 139.74 }, vn)).toBe(false) // Tokyo
  const tok = resolveScope({ id: 'city-tok', name: 'Tokyo', sub: 'Japan', kind: 'city', lat: 35.68, lng: 139.76 })
  expect(tok.kind).toBe('city')
  expect(inScope({ lat: 35.67, lng: 139.74 }, tok)).toBe(true) // ~2 km away
  expect(inScope({ lat: 10.78, lng: 106.69 }, tok)).toBe(false)
})
