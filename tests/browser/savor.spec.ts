import { test, expect, type Page } from '@playwright/test'
import { fakeSupabase, ME } from './fake-supabase'

// Savorlog page (M4 steps 4c–4d): a required location gate scopes the page to a
// country or city; then the catalogue by country → dish, the search-to-add box
// and the add/edit card. The map needs Google, so here we check the panel.

const EATERIES = [
  { id: 'e1', google_place_id: 'gp1', name: 'Phở Hòa Pasteur', address: 'Quận 3', lat: 10.789, lng: 106.689, cuisine: 'vietnamese', dish: 'pho', michelin: 'mentioned', michelin_year: 2025, street_food: true, fine_dining: false, price: 2, note: 'Go before 9am', deleted_at: null },
  { id: 'e2', google_place_id: 'gp2', name: 'Anan Saigon', address: 'Quận 1', lat: 10.77, lng: 106.70, cuisine: 'vietnamese', dish: null, michelin: '1', michelin_year: 2025, street_food: false, fine_dining: true, price: 4, note: null, deleted_at: null },
  { id: 'e3', google_place_id: 'gp3', name: 'Sushi Saito', address: 'Tokyo', lat: 35.67, lng: 139.74, cuisine: 'japanese', dish: null, michelin: null, michelin_year: null, street_food: false, fine_dining: false, price: 4, note: null, deleted_at: null }
]
const REVIEWS = [{ eatery_id: 'e1', user_id: ME, status: 'vis', verdict: 'revisit', rating: 4.5, updated_at: '2026-10-01T00:00:00Z' }]

const CANNED = [
  { id: 'c-vn', displayName: { text: 'Vietnam' }, formattedAddress: 'Vietnam', location: { latitude: 16, longitude: 106 }, types: ['country'], viewport: { low: { latitude: 8.2, longitude: 102 }, high: { latitude: 23.4, longitude: 109.6 } } },
  { id: 'c-it', displayName: { text: 'Italy' }, formattedAddress: 'Italy', location: { latitude: 42, longitude: 12 }, types: ['country'], viewport: { low: { latitude: 36.6, longitude: 6.6 }, high: { latitude: 47.1, longitude: 18.6 } } }
]
const EATERY_PLACES = [{ id: 'gp-new', displayName: { text: 'Bún Chả Hương Liên' }, formattedAddress: 'Hanoi, Vietnam', location: { latitude: 21.0, longitude: 105.85 } }]

// One stub for all Google Places calls: the location gate (fieldmask has
// types), the eatery search (it doesn't), and place-photo details (GET).
const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
async function fakeGoogle(page: Page) {
  await page.route('https://places.googleapis.com/**', route => {
    const req = route.request()
    if (req.method() === 'POST') {
      const fm = req.headers()['x-goog-fieldmask'] || ''
      const q = norm(JSON.parse(req.postData() || '{}').textQuery || '')
      if (fm.includes('types')) {
        return route.fulfill({ json: { places: CANNED.filter(p => norm(p.displayName.text + ' ' + p.formattedAddress).includes(q)) } })
      }
      return route.fulfill({ json: { places: EATERY_PLACES.filter(p => norm(p.displayName.text).includes(q)) } })
    }
    return route.fulfill({ json: { photos: [] } }) // no Google photo → placeholder
  })
}

async function enter(page: Page, type: string, name: RegExp) {
  await fakeGoogle(page)
  await page.goto('./savor')
  const dialog = page.getByRole('dialog', { name: 'Where to see eateries' })
  await dialog.getByRole('searchbox').fill(type)
  await dialog.getByRole('button', { name }).click()
}

test('the gate is required, then filters to the chosen country', async ({ page }) => {
  await fakeSupabase(page, { eateries: EATERIES, eateryReviews: REVIEWS })
  await page.goto('./savor')
  await expect(page.getByRole('dialog', { name: 'Where to see eateries' })).toBeVisible()
  await fakeGoogle(page)
  const dialog = page.getByRole('dialog', { name: 'Where to see eateries' })
  await dialog.getByRole('searchbox').fill('viet')
  await dialog.getByRole('button', { name: /Vietnam/ }).click()

  await expect(page.getByText(/Showing/)).toContainText('Vietnam')
  const side = page.getByRole('complementary', { name: 'Catalogue' })
  await expect(side.getByText('2', { exact: true }).first()).toBeVisible() // Tokyo's filtered out
  await side.getByRole('button', { name: /Vietnamese/ }).click()
  await expect(side.getByRole('button', { name: /Anan Saigon/ })).toBeVisible()
})

test('search-to-add opens the add card and saves a new eatery', async ({ page }) => {
  const db = await fakeSupabase(page, { eateries: EATERIES, eateryReviews: REVIEWS })
  await enter(page, 'viet', /Vietnam/)
  const side = page.getByRole('complementary', { name: 'Catalogue' })
  await side.getByRole('searchbox', { name: /Search Google/ }).fill('bun')
  await side.getByRole('button', { name: 'Search' }).click()
  await side.getByRole('button', { name: /Bún Chả Hương Liên/ }).click()

  const form = side.getByRole('form', { name: 'Add an eatery' })
  await expect(form).toBeVisible()
  await form.getByLabel('Cuisine (country)').selectOption({ label: 'Vietnamese' })
  await form.getByRole('radio', { name: '2 of 4' }).click() // price $$
  await form.getByRole('button', { name: 'Add eatery' }).click()

  // Wait for the reload to show the new row, then check what reached the db.
  await side.getByRole('button', { name: /Vietnamese/ }).click()
  await expect(side.getByRole('button', { name: /Bún Chả Hương Liên/ })).toBeVisible()
  expect(db.eateries.some(e => e.name === 'Bún Chả Hương Liên' && e.cuisine === 'vietnamese' && e.price === 2)).toBe(true)
})

test('editing an eatery shows its fields and the photo placeholder', async ({ page }) => {
  await fakeSupabase(page, { eateries: EATERIES, eateryReviews: REVIEWS })
  await enter(page, 'viet', /Vietnam/)
  const side = page.getByRole('complementary', { name: 'Catalogue' })
  await side.getByRole('button', { name: /Vietnamese/ }).click()
  await side.getByRole('button', { name: /Anan Saigon/ }).click()

  const form = side.getByRole('form', { name: 'Edit eatery' })
  await expect(form.getByRole('radio', { name: '4 of 4' })).toHaveAttribute('aria-checked', 'true') // price $$$$
  await expect(form.getByText('Photo coming soon')).toBeVisible() // no uploads, no Google photo
})

test('removing an eatery sends it to the pending-deletion queue', async ({ page }) => {
  const db = await fakeSupabase(page, { eateries: EATERIES, eateryReviews: REVIEWS })
  await enter(page, 'viet', /Vietnam/)
  const side = page.getByRole('complementary', { name: 'Catalogue' })
  await side.getByRole('button', { name: /Vietnamese/ }).click()
  await side.getByRole('button', { name: /Anan Saigon/ }).click()
  await side.getByRole('form', { name: 'Edit eatery' }).getByRole('button', { name: 'Remove…' }).click()
  await side.getByRole('button', { name: 'Remove', exact: true }).click()

  await expect(side.getByRole('button', { name: /Anan Saigon/ })).toHaveCount(0)
  expect((db.eateries.find(e => e.id === 'e2') as { deleted_at: string | null }).deleted_at).toBeTruthy()
})

test('a country with no eateries says so; Change reopens the gate', async ({ page }) => {
  await fakeSupabase(page, { eateries: EATERIES, eateryReviews: REVIEWS })
  await enter(page, 'italy', /Italy/)
  await expect(page.getByText(/No eateries in Italy yet/)).toBeVisible()
  await page.getByRole('button', { name: 'Change' }).click()
  await expect(page.getByRole('dialog', { name: 'Where to see eateries' })).toBeVisible()
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
  expect(vn.bounds).toBeTruthy()
  expect(inScope({ lat: 10.78, lng: 106.69 }, vn)).toBe(true)
  expect(inScope({ lat: 35.67, lng: 139.74 }, vn)).toBe(false)
  const tok = resolveScope({ id: 'city-tok', name: 'Tokyo', sub: 'Japan', kind: 'city', lat: 35.68, lng: 139.76 })
  expect(tok.kind).toBe('city')
  expect(inScope({ lat: 35.67, lng: 139.74 }, tok)).toBe(true)
  expect(inScope({ lat: 10.78, lng: 106.69 }, tok)).toBe(false)
})
