import { test, expect, type Page } from '@playwright/test'
import { fakeSupabase, ME, FRIEND } from './fake-supabase'

// Munch List on phones (session 13, E107, approved mockup at 412 × 891): the
// map fills the screen; a top sheet holds one search box (a place to go to,
// or an eatery to add) and opens pulled down; the Catalogue is a bottom sheet
// whose handle closes it completely; Family and Map look live in ⋯.
test.beforeEach(({}, info) => { test.skip(info.project.name !== 'phone', 'phone layout') })

const EATERIES = [
  { id: 'e1', google_place_id: 'gp1', name: 'Phở Hòa Pasteur', address: 'Quận 3', lat: 10.789, lng: 106.689, cuisine: 'vietnamese', dish: 'pho', michelin: null, michelin_year: null, street_food: true, fine_dining: false, price: 2, note: null, deleted_at: null },
  { id: 'e2', google_place_id: 'gp2', name: 'Anan Saigon', address: 'Quận 1', lat: 10.77, lng: 106.70, cuisine: 'vietnamese', dish: null, michelin: '1', michelin_year: 2025, street_food: false, fine_dining: true, price: 4, note: null, deleted_at: null }
]
const CANNED = [
  { id: 'c-vn', displayName: { text: 'Vietnam' }, formattedAddress: 'Vietnam', location: { latitude: 16, longitude: 106 }, types: ['country'], viewport: { low: { latitude: 8.2, longitude: 102 }, high: { latitude: 23.4, longitude: 109.6 } } }
]
const EATERY_PLACES = [
  { id: 'gp-new', displayName: { text: 'Bún Chả Hương Liên' }, formattedAddress: 'Hanoi, Vietnam', location: { latitude: 21.0, longitude: 105.85 } },
  { id: 'gp2', displayName: { text: 'Anan Saigon' }, formattedAddress: 'Quận 1', location: { latitude: 10.77, longitude: 106.70 } }
]
const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
async function fakeGoogle(page: Page) {
  await page.route('https://places.googleapis.com/**', route => {
    const req = route.request()
    if (req.method() === 'POST') {
      const fm = req.headers()['x-goog-fieldmask'] || ''
      const q = norm(JSON.parse(req.postData() || '{}').textQuery || '')
      if (fm.includes('types')) return route.fulfill({ json: { places: CANNED.filter(p => norm(p.displayName.text).includes(q)) } })
      return route.fulfill({ json: { places: EATERY_PLACES.filter(p => norm(p.displayName.text).includes(q) || q.length >= 3) } })
    }
    return route.fulfill({ json: { photos: [] } })
  })
}

async function open(page: Page, opts: Parameters<typeof fakeSupabase>[1] = {}) {
  const db = await fakeSupabase(page, { eateries: EATERIES, ...opts })
  await fakeGoogle(page)
  await page.goto('./savor')
  await expect(page.getByRole('heading', { level: 1, name: 'Munch List' })).toBeVisible()
  return db
}

test('opens with the search pulled down, no popup, Catalogue closed to its handle', async ({ page }) => {
  await open(page)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Search' })).toHaveAttribute('data-snap', 'half')
  await expect(page.getByRole('searchbox', { name: 'City, country or eatery' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Catalogue' })).toHaveAttribute('data-snap', 'closed')
  // The site header gives way to Munch List's own title bar.
  await expect(page.getByRole('link', { name: 'Home' })).toBeVisible()
})

test('one box: a place to go to, or an eatery to add', async ({ page }) => {
  const db = await open(page)
  const search = page.getByRole('region', { name: 'Search' })
  await search.getByRole('searchbox').fill('viet')
  await expect(search.getByText('Go to a place')).toBeVisible()
  await search.getByRole('list', { name: 'Places' }).getByRole('button', { name: /Vietnam/ }).click()
  await expect(search).toHaveAttribute('data-snap', 'closed')

  // Pull it down again and add an eatery.
  await search.getByRole('button', { name: /Search: make bigger/ }).click()
  await search.getByRole('searchbox').fill('bun cha')
  const eats = search.getByRole('list', { name: 'Eateries' })
  await expect(eats.getByRole('button', { name: /Anan Saigon.*Already in · open/ })).toBeVisible()
  await eats.getByRole('button', { name: /Bún Chả Hương Liên.*\+ Add/ }).click()
  const cat = page.getByRole('region', { name: 'Catalogue' })
  await expect(cat).toHaveAttribute('data-snap', 'full')
  const form = cat.getByRole('form', { name: 'Add an eatery' })
  await form.getByLabel('Cuisine (country)').selectOption({ label: 'Vietnamese' })
  await form.getByRole('button', { name: 'Add eatery' }).click()
  await expect.poll(() => db.eateries.some(e => e.name === 'Bún Chả Hương Liên')).toBe(true)
})

test('the Catalogue handle opens half, then full; ⋯ holds Family and Map look', async ({ page }) => {
  await open(page, { savorPeople: [{ user_id: ME, display_name: 'Hanh', is_owner: true, joined_at: null }, { user_id: FRIEND, display_name: 'Mai', is_owner: false, joined_at: null }] })
  const cat = page.getByRole('region', { name: 'Catalogue' })
  await cat.getByRole('button', { name: /Catalogue: make bigger/ }).click()
  await expect(cat).toHaveAttribute('data-snap', 'half')
  await expect(cat.getByRole('button', { name: /^Vietnamese/ })).toBeVisible()
  await cat.getByRole('button', { name: /Catalogue: make bigger/ }).click()
  await expect(cat).toHaveAttribute('data-snap', 'full')

  await page.getByRole('button', { name: 'Munch List menu' }).click()
  await expect(page.getByRole('menuitem')).toHaveText(['Family', 'Map look & GPins'])
  await page.getByRole('menuitem', { name: 'Family' }).click()
  await expect(page.getByRole('dialog', { name: 'Savorlog family' })).toBeVisible()
})

test('swiping a handle back toward its edge closes the sheet completely', async ({ page }) => {
  await open(page)
  const search = page.getByRole('region', { name: 'Search' })
  const grab = search.getByRole('button', { name: /Search: make bigger/ })
  const box = (await grab.boundingBox())!
  // Top sheet: swipe up (toward the top edge) closes it.
  await grab.dispatchEvent('pointerdown', { clientX: box.x + box.width / 2, clientY: box.y + 10, pointerId: 1 })
  await grab.dispatchEvent('pointermove', { clientX: box.x + box.width / 2, clientY: box.y - 80, pointerId: 1 })
  await grab.dispatchEvent('pointerup', { clientX: box.x + box.width / 2, clientY: box.y - 80, pointerId: 1 })
  await expect(search).toHaveAttribute('data-snap', 'closed')
})
