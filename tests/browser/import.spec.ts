import { test, expect } from '@playwright/test'
import { fakeSupabase, fakePlaces, ME, FRIEND } from './fake-supabase'

// The old-Wanderlog pin import queue (E71): owner-only button, loading the
// prepared file, the prefilled add cards, Save and next, Skip for good.

const PREPARED = {
  app: "Hanh's Log import",
  version: 1,
  places: [
    {
      place_id: 'gp-cathedral', city: 'Hồ Chí Minh City', country: 'Vietnam', lat: 10.7798, lng: 106.699,
      category: 'attraction', sub: 'worship', leaf: 'church',
      name_en: 'Notre Dame Cathedral of Saigon', name_local: 'Nhà Thờ Đức Bà',
      michelin: null, michelin_year: null, michelin_url: null, street_food: false, fine_dining: false,
      note: null, why: 'old icon church',
      copies: [{ trip: 'Saigon Leg', name: 'Nhà Thờ Đúc Bà; Notre Dame Cathedral of Saigon', category: 'attraction', icon: 'church', note: null }]
    },
    {
      place_id: 'gp-banhxeo', city: 'Hồ Chí Minh City', country: 'Vietnam', lat: 10.7896, lng: 106.6913,
      category: 'food', sub: 'vietnamese', leaf: 'banh-xeo',
      name_en: null, name_local: 'Bánh Xèo 46A',
      michelin: 'mentioned', michelin_year: 2026, michelin_url: 'https://guide.michelin.com/en/ho-chi-minh/restaurant/banh-xeo-46a',
      street_food: true, fine_dining: false, note: null, why: 'Bib Gourmand',
      copies: [{ trip: 'Saigon Leg', name: 'Banh Xeo; Bánh Xèo 46A', category: 'dining', icon: 'street_food', note: null }]
    },
    {
      place_id: 'gp-pho10', city: 'Hà Nội', country: 'Vietnam', lat: 21.03, lng: 105.85,
      category: 'food', sub: 'vietnamese', leaf: 'pho',
      name_en: null, name_local: 'Phở 10 Lý Quốc Sư',
      michelin: 'mentioned', michelin_year: 2026, michelin_url: null, street_food: false, fine_dining: false, note: null, why: null,
      copies: [
        { trip: 'Hà Nội', name: 'Pho*; Pho 10 Ly Quoc Su', category: 'dining', icon: 'pho', note: null },
        { trip: 'Hà Nội', name: '⭐ Pho 10 Ly Quoc Su', category: 'dining', icon: 'pho', note: null }
      ]
    }
  ]
}

test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }))
  await fakePlaces(page, [])
})

test('the import button shows only to the Savorlog owner', async ({ page }) => {
  await fakeSupabase(page, { savorPeople: [{ user_id: FRIEND, display_name: 'Mai', is_owner: true, joined_at: null }, { user_id: ME, display_name: 'Hanh', is_owner: false, joined_at: '2026-10-01T00:00:00Z' }] })
  await page.goto('./wander')
  await expect(page.getByRole('button', { name: /New trip/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Import old pins/ })).toHaveCount(0)
})

test('load the prepared file, save a place to the trip, skip an eatery for good', async ({ page }) => {
  const db = await fakeSupabase(page)
  await page.goto('./wander')
  await page.getByRole('link', { name: /Import old pins/ }).click()
  await expect(page.getByRole('heading', { name: 'Import old pins' })).toBeVisible()

  // The raw Wanderlog export is refused with a plain message.
  const input = page.locator('input[type="file"]')
  await input.setInputFiles({ name: 'export.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ app: "Hanh's Wanderlog", trips: [] })) })
  await expect(page.getByRole('alert')).toContainText('raw Wanderlog export')

  await input.setInputFiles({ name: 'prepared.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(PREPARED)) })
  await expect(page.getByText('0 of 3 places done')).toBeVisible()
  expect(db.importItems).toHaveLength(3)

  // Cities, biggest first; Saigon opens with its categories in the standard order.
  const cities = page.getByRole('navigation', { name: 'Cities' })
  await expect(cities.getByRole('button')).toHaveText([/Hồ Chí Minh City\s*0 \/ 2/, /Hà Nội\s*0 \/ 1/])
  await page.getByLabel('Trip for Hồ Chí Minh City').selectOption('trip-saigon')

  // Attraction → the prefilled add card (English : Local, category path).
  await page.getByRole('button', { name: /Attraction/ }).click()
  const card = page.getByRole('form', { name: 'Add a place' })
  await expect(card.getByLabel('English title')).toHaveValue('Notre Dame Cathedral of Saigon')
  await expect(card.getByLabel('Local title')).toHaveValue('Nhà Thờ Đức Bà')
  await expect(card.getByLabel('Category')).toHaveValue('attraction')
  await expect(card.getByLabel('Group')).toHaveValue('worship')
  await expect(card.getByLabel('Type')).toHaveValue('church')
  await expect(page.getByLabel('From old Wanderlog')).toContainText('Nhà Thờ Đúc Bà; Notre Dame Cathedral of Saigon')
  await card.getByRole('button', { name: 'Save and next' }).click()

  // Saved as a trip pin; the import row is ticked off and we're back on the city.
  await expect(page.getByText('All Attraction places in Hồ Chí Minh City are done.')).toBeVisible()
  await expect.poll(() => db.pins.length).toBe(1)
  expect(db.pins[0]).toMatchObject({ trip_id: 'trip-saigon', name: 'Notre Dame Cathedral of Saigon : Nhà Thờ Đức Bà', category: 'attraction', subcategory: 'worship', subsubcategory: 'church' })
  expect(db.importItems.find(i => i.google_place_id === 'gp-cathedral')).toMatchObject({ status: 'saved', saved_pin_id: db.pins[0].id })

  // Nom-Nom → the Savorlog card, MICHELIN and street food prefilled; skip it for good.
  await page.getByRole('button', { name: /Nom-Nom/ }).click()
  const eat = page.getByRole('form', { name: 'Add an eatery' })
  await expect(eat.getByLabel('Local title')).toHaveValue('Bánh Xèo 46A')
  await expect(eat.getByLabel('Cuisine (country)')).toHaveValue('vietnamese')
  await expect(eat.getByLabel('Main dish')).toHaveValue('banh-xeo')
  await expect(eat.getByRole('radio', { name: 'Mentioned' })).toHaveAttribute('aria-checked', 'true')
  await expect(eat.getByLabel('Street food')).toBeChecked()
  await eat.getByRole('button', { name: 'Skip for good' }).click()
  await eat.getByRole('button', { name: 'Skip', exact: true }).click()
  await expect(page.getByText('All Nom-Nom places in Hồ Chí Minh City are done.')).toBeVisible()
  expect(db.importItems.find(i => i.google_place_id === 'gp-banhxeo')).toMatchObject({ status: 'skipped' })
  expect(db.eateries).toHaveLength(0)
  await expect(page.getByText('2 of 3 places done · 1 skipped')).toBeVisible()
})

test('import helpers: parse, cities, order, next pending', async () => {
  const { parsePrepared, cityList, categoryItems, nextPending } = await import('../../src/lib/pinImportRules')
  const rows = parsePrepared(JSON.stringify(PREPARED))
  expect(rows[1].prefill).toMatchObject({ category: 'food', michelin: 'mentioned', michelin_year: 2026, street_food: true })
  expect(() => parsePrepared('{')).toThrow("isn't readable JSON")
  expect(() => parsePrepared('{"app":"x"}')).toThrow("isn't a Hanh's Log import file")
  const items = rows.map((r, i) => ({ ...r, id: `i${i}`, status: (i === 0 ? 'saved' : 'pending') as 'saved' | 'pending', saved_pin_id: null, saved_eatery_id: null }))
  expect(cityList(items).map(c => [c.city, c.tally.done, c.tally.total])).toEqual([['Hồ Chí Minh City', 1, 2], ['Hà Nội', 0, 1]])
  expect(categoryItems(items, 'Hồ Chí Minh City', 'food').map(i => i.google_place_id)).toEqual(['gp-banhxeo'])
  expect(nextPending(items, 0)).toBe(1)
  expect(nextPending(items.map(i => ({ ...i, status: 'saved' as const })), 0)).toBeNull()
})
