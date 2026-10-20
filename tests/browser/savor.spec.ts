import { test, expect, type Page } from '@playwright/test'
import { fakeSupabase, ME, FRIEND } from './fake-supabase'

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

// The computer layout; phones have their own Munch List (savor-phone.spec.ts).
test.beforeEach(({}, info) => { test.skip(info.project.name === 'phone', 'computer layout; phone layout in savor-phone.spec.ts') })

// Session 13 (E108): no startup popup; the City/Country field picks a place.
async function enter(page: Page, type: string, name: RegExp) {
  await fakeGoogle(page)
  await page.goto('./savor')
  const side = page.getByRole('complementary', { name: 'Catalogue' })
  await side.getByRole('searchbox', { name: 'City or country' }).fill(type)
  await side.getByRole('list', { name: 'Places' }).getByRole('button', { name }).click()
}

test('Munch List opens on the map with no startup popup (session 13); the top bar has no place line', async ({ page }) => {
  await fakeSupabase(page, { eateries: EATERIES, eateryReviews: REVIEWS })
  await page.goto('./savor')
  await expect(page.getByRole('heading', { name: 'Munch List' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText(/Showing/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Change' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Family' })).toBeVisible()
  // A pick only moves the map; without a map (no key) the list shows everything.
  const side = page.getByRole('complementary', { name: 'Catalogue' })
  await expect(side.getByText('3', { exact: true }).first()).toBeVisible()
  await side.getByRole('button', { name: /^Vietnamese/ }).click()
  await expect(side.getByRole('button', { name: /Anan Saigon/ }).first()).toBeVisible()
})

test('the City/Country field in the panel picks a place like the popup does', async ({ page }) => {
  await fakeSupabase(page, { eateries: EATERIES, eateryReviews: REVIEWS })
  await fakeGoogle(page)
  await page.goto('./savor')

  const side = page.getByRole('complementary', { name: 'Catalogue' })
  const field = side.getByRole('searchbox', { name: 'City or country' })
  await expect(field).toHaveAttribute('placeholder', 'City/Country')
  await field.fill('viet')
  await side.getByRole('list', { name: 'Places' }).getByRole('button', { name: /Vietnam/ }).click()

  await expect(field).toHaveValue('') // cleared, ready for the next place
  await expect(side.getByRole('list', { name: 'Places' })).toHaveCount(0)

  // A second pick works too.
  await field.fill('ital')
  await side.getByRole('list', { name: 'Places' }).getByRole('button', { name: /Italy/ }).click()
  await expect(field).toHaveValue('')
})

test('search-to-add opens the add card and saves a new eatery', async ({ page }) => {
  const db = await fakeSupabase(page, { eateries: EATERIES, eateryReviews: REVIEWS })
  await enter(page, 'viet', /Vietnam/)
  const side = page.getByRole('complementary', { name: 'Catalogue' })
  await side.getByRole('searchbox', { name: /Search Google/ }).fill('bun')
  await side.getByRole('button', { name: 'Search' }).click()
  await side.getByRole('button', { name: /Bún Chả Hương Liên/ }).first().click()

  const form = side.getByRole('form', { name: 'Add an eatery' })
  await expect(form).toBeVisible()
  await form.getByLabel('Cuisine (country)').selectOption({ label: 'Vietnamese' })
  await form.getByRole('radio', { name: '2 of 4' }).click() // price $$
  await form.getByRole('button', { name: 'Add eatery' }).click()

  // Wait for the reload to show the new row, then check what reached the db.
  await side.getByRole('button', { name: /^Vietnamese/ }).click()
  await expect(side.getByRole('button', { name: /Bún Chả Hương Liên/ }).first()).toBeVisible()
  expect(db.eateries.some(e => e.name === 'Bún Chả Hương Liên' && e.cuisine === 'vietnamese' && e.price === 2)).toBe(true)
})

test('the cuisine picker in the add card is A–Z (session 11)', async ({ page }) => {
  await fakeSupabase(page, { eateries: EATERIES, eateryReviews: REVIEWS })
  await enter(page, 'viet', /Vietnam/)
  const side = page.getByRole('complementary', { name: 'Catalogue' })
  await side.getByRole('searchbox', { name: /Search Google/ }).fill('bun')
  await side.getByRole('button', { name: 'Search' }).click()
  await side.getByRole('button', { name: /Bún Chả Hương Liên/ }).first().click()
  const labels = (await side.getByLabel('Cuisine (country)').locator('option').allTextContents()).slice(1)
  expect(labels.length).toBeGreaterThan(10)
  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })
  expect(labels).toEqual([...labels].sort(collator.compare))
})

test('the main dish picker in the add card is A–Z (session 14)', async ({ page }) => {
  await fakeSupabase(page, { eateries: EATERIES, eateryReviews: REVIEWS })
  await enter(page, 'viet', /Vietnam/)
  const side = page.getByRole('complementary', { name: 'Catalogue' })
  await side.getByRole('searchbox', { name: /Search Google/ }).fill('bun')
  await side.getByRole('button', { name: 'Search' }).click()
  await side.getByRole('button', { name: /Bún Chả Hương Liên/ }).first().click()
  await side.getByLabel('Cuisine (country)').selectOption({ label: 'Vietnamese' })
  const dishes = (await side.getByLabel('Main dish').locator('option').allTextContents()).slice(2) // after the placeholder and "+ Add a new dish…"
  expect(dishes.length).toBe(28)
  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })
  expect(dishes).toEqual([...dishes].sort(collator.compare))
})

test('editing an eatery shows its fields and the photo placeholder', async ({ page }) => {
  await fakeSupabase(page, { eateries: EATERIES, eateryReviews: REVIEWS })
  await enter(page, 'viet', /Vietnam/)
  const side = page.getByRole('complementary', { name: 'Catalogue' })
  await side.getByRole('button', { name: /^Vietnamese/ }).click()
  await side.getByRole('button', { name: /Anan Saigon/ }).first().click()

  const form = side.getByRole('form', { name: 'Edit eatery' })
  await expect(form.getByRole('radio', { name: '4 of 4' })).toHaveAttribute('aria-checked', 'true') // price $$$$
  await expect(form.getByText('Photo coming soon')).toBeVisible() // no uploads, no Google photo
})

test('removing an eatery sends it to the pending-deletion queue', async ({ page }) => {
  const db = await fakeSupabase(page, { eateries: EATERIES, eateryReviews: REVIEWS })
  await enter(page, 'viet', /Vietnam/)
  const side = page.getByRole('complementary', { name: 'Catalogue' })
  await side.getByRole('button', { name: /^Vietnamese/ }).click()
  await side.getByRole('button', { name: /Anan Saigon/ }).first().click()
  await side.getByRole('form', { name: 'Edit eatery' }).getByRole('button', { name: 'Remove…' }).click()
  await side.getByRole('button', { name: 'Remove', exact: true }).click()

  // Wait for the removal itself (the list can hide the row before it lands).
  await expect.poll(() => (db.eateries.find(e => e.id === 'e2') as { deleted_at: string | null }).deleted_at).toBeTruthy()
  await expect(side.getByRole('button', { name: /Anan Saigon/ })).toHaveCount(0)
})

test('an empty catalogue says so', async ({ page }) => {
  await fakeSupabase(page, { eateries: [], eateryReviews: [] })
  await enter(page, 'italy', /Italy/)
  await expect(page.getByText(/No eateries in this part of the map/)).toBeVisible()
})

test('the Family dialog lists the circle; the owner can remove a member', async ({ page }) => {
  await fakeSupabase(page, {
    eateries: EATERIES,
    savorPeople: [
      { user_id: ME, display_name: 'Hanh', is_owner: true, joined_at: null },
      { user_id: FRIEND, display_name: 'Mai', is_owner: false, joined_at: '2026-10-02T15:00:00Z' }
    ]
  })
  await enter(page, 'viet', /Vietnam/)
  await page.getByRole('button', { name: 'Family' }).click()
  const dlg = page.getByRole('dialog', { name: 'Savorlog family' })
  await expect(dlg).toBeVisible()
  await expect(dlg.getByLabel('Invite link')).toHaveValue(/savor\/join\/savor-tok/)
  await expect(dlg.getByText('Mai', { exact: true })).toBeVisible()
  page.on('dialog', d => d.accept())
  await dlg.getByRole('button', { name: 'Remove' }).click()
  await expect(dlg.getByText('Mai', { exact: true })).toHaveCount(0)
})

test('country → dish tree helper', async () => {
  const { buildCountryTree } = await import('../../src/lib/savorTree')
  const tree = buildCountryTree(EATERIES.map(e => ({ cuisine: e.cuisine, dish: e.dish, id: e.id })))
  // A–Z (session 10): Japanese before Vietnamese.
  expect(tree.map(c => c.key)).toEqual(['japanese', 'vietnamese'])
  expect(tree[1].loose.map(e => e.id)).toEqual(['e2'])
  expect(tree[1].dishes.map(d => d.key)).toEqual(['pho'])
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


test('numbered bubbles: crowded pins merge, the Day route stops never do, street level never merges (session 11)', async () => {
  const { clusterPins, bubbleSize, NO_MERGE_ZOOM } = await import('../../src/lib/pinClusters')
  const pts = [
    { id: 'a', x: 100, y: 100, faded: false },
    { id: 'b', x: 120, y: 110, faded: true },
    { id: 'c', x: 130, y: 95, faded: false },
    { id: 'd', x: 400, y: 400, faded: false },
    { id: 'e', x: 105, y: 102, faded: false, keepApart: true }
  ]
  const { singles, groups } = clusterPins(pts, 12)
  expect(groups).toHaveLength(1)
  expect(groups[0].ids.sort()).toEqual(['a', 'b', 'c'])
  expect(groups[0].faded).toBe(false) // one full-strength pin keeps the bubble full
  expect(singles.sort()).toEqual(['d', 'e'])
  expect(clusterPins(pts.map(p => ({ ...p, faded: true })), 12).groups[0].faded).toBe(true)
  expect(clusterPins(pts, NO_MERGE_ZOOM).groups).toHaveLength(0)
  expect(bubbleSize(2)).toBe(32)
  expect(bubbleSize(500)).toBe(52)
})

test('fly-over path: ends where asked, dips out for far hops, fits a box (session 11)', async () => {
  const { glidePath, zoomForBounds, boundsCentre, glideMs } = await import('../../src/lib/glide')
  const saigon = { lat: 10.78, lng: 106.7, zoom: 13 }
  const tokyo = { lat: 35.68, lng: 139.76, zoom: 13 }
  const end = glidePath(saigon, tokyo, 1, 1200)
  expect(end.lat).toBeCloseTo(35.68, 4)
  expect(end.lng).toBeCloseTo(139.76, 4)
  expect(end.zoom).toBeCloseTo(13, 4)
  expect(glidePath(saigon, tokyo, 0.5, 1200).zoom).toBeLessThan(6) // zooms out on the way
  const near = { lat: 10.79, lng: 106.71, zoom: 13 }
  expect(glidePath(saigon, near, 0.5, 1200).zoom).toBeCloseTo(13, 1) // a short hop stays in
  expect(glideMs(saigon, tokyo, 1200)).toBeLessThanOrEqual(1800)
  const vn = { south: 8.2, west: 102, north: 23.4, east: 109.6 }
  const z = zoomForBounds(vn, 1200, 800, 24)
  expect(z).toBeGreaterThan(4)
  expect(z).toBeLessThan(7)
  const mid = boundsCentre({ south: -20, west: 170, north: -10, east: -170 }) // across the 180° line
  expect(Math.abs(mid.lng)).toBeGreaterThan(175)
})

test('map-view filter: inside the visible area, across the 180° line too', async () => {
  const { inView } = await import('../../src/lib/countryBounds')
  const saigon = { lat: 10.78, lng: 106.7 }
  expect(inView({ south: 8, west: 102, north: 23, east: 110 }, saigon.lat, saigon.lng)).toBe(true)
  expect(inView({ south: 30, west: 130, north: 46, east: 146 }, saigon.lat, saigon.lng)).toBe(false)
  // A Pacific view from Japan (140°E) to Hawaii (-150°): Honolulu is in, Saigon isn't.
  expect(inView({ south: 0, west: 140, north: 50, east: -150 }, 21.3, -157.8)).toBe(true)
  expect(inView({ south: 0, west: 140, north: 50, east: -150 }, saigon.lat, saigon.lng)).toBe(false)
})
