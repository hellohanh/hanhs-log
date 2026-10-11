import { test, expect } from '@playwright/test'
import { fakePlaces, fakeSupabase, FRIEND, ME } from './fake-supabase'

// Pins (M3 step 4): the Places panel's search box, the add / edit card,
// WTG / VIS with verdicts and half-star ratings, MICHELIN, and the list
// grouped by category. The map itself needs Google, so the pin drawing is
// checked through lib/pinDraw directly.

const PHO = { id: 'g-pho', name: 'Phở Hòa Pasteur', address: '260C Pasteur, Quận 3', lat: 10.789, lng: 106.689 }
const MARKET = { id: 'g-ben-thanh', name: 'Bến Thành Market', address: 'Lê Lợi, Quận 1', lat: 10.772, lng: 106.698 }

const SAVED_PINS = [
  { id: 'pin-pho', trip_id: 'trip-saigon', google_place_id: 'g-pho', name: 'Phở Hòa Pasteur', address: '260C Pasteur', lat: 10.789, lng: 106.689, category: 'food', subcategory: 'vietnamese', subsubcategory: 'pho', michelin: 'mentioned', michelin_year: 2025, street_food: false, fine_dining: false, note: null },
  { id: 'pin-anan', trip_id: 'trip-saigon', google_place_id: 'g-anan', name: 'Anan Saigon', address: null, lat: 10.771, lng: 106.704, category: 'food', subcategory: 'vietnamese', subsubcategory: null, michelin: '1', michelin_year: 2025, street_food: false, fine_dining: true, note: null },
  { id: 'pin-ben-thanh', trip_id: 'trip-saigon', google_place_id: 'g-ben-thanh', name: 'Bến Thành Market', address: null, lat: 10.772, lng: 106.698, category: 'shopping', subcategory: 'market', subsubcategory: null, michelin: null, michelin_year: null, street_food: false, fine_dining: false, note: null }
]

test('add a pin: search Google, pick the category by hand, VIS needs a verdict, half stars, MICHELIN', async ({ page }) => {
  const db = await fakeSupabase(page)
  await fakePlaces(page, [PHO, MARKET])
  await page.goto('./wander/trip/trip-saigon')
  const places = page.getByRole('complementary', { name: 'Places' })
  await expect(places.getByText('No places on this trip yet.')).toBeVisible()

  await places.getByRole('searchbox', { name: 'Search Google for a place to add' }).fill('pho hoa')
  await places.getByRole('button', { name: 'Search' }).click()
  await places.getByRole('button', { name: /Phở Hòa Pasteur/ }).click()

  const card = places.getByRole('form', { name: 'Add a place' })
  await expect(card.getByLabel('Name')).toHaveValue('Phở Hòa Pasteur')
  await expect(card.getByText('260C Pasteur, Quận 3')).toBeVisible()
  // Category first: nothing is guessed.
  await card.getByRole('button', { name: 'Add pin' }).click()
  await expect(card.getByRole('alert')).toHaveText('Pick a category.')
  // MICHELIN is only offered for food and drink.
  await card.getByLabel('Category').selectOption('shopping')
  await expect(card.getByRole('radiogroup', { name: 'MICHELIN' })).toHaveCount(0)
  await card.getByLabel('Category').selectOption('food')
  await card.getByLabel('Cuisine').selectOption('vietnamese')
  await card.getByLabel('Dish').selectOption('pho')

  // WTG is the default; VIS can't be saved without ✓, – or ✗.
  await expect(card.getByRole('radio', { name: 'WTG' })).toHaveAttribute('aria-checked', 'true')
  await card.getByRole('radio', { name: 'VIS' }).click()
  await card.getByRole('button', { name: 'Add pin' }).click()
  await expect(card.getByRole('alert')).toHaveText('Pick ✓, – or ✗ to save it as VIS.')
  await card.getByRole('radio', { name: /Revisit/ }).click()
  await card.getByRole('button', { name: '4.5 stars' }).click()
  await expect(card.getByRole('slider', { name: 'Your rating' })).toHaveAttribute('aria-valuetext', '4.5 of 5')

  await card.getByRole('radio', { name: 'Mentioned' }).click()
  await expect(card.getByLabel('Year')).toHaveValue('2026')
  await card.getByLabel('Street food').check()
  await card.getByRole('button', { name: 'Add pin' }).click()

  // Back to the tree: Nom-Nom appears (collapsed), no Shopping branch.
  await expect(places.getByRole('button', { name: /^Nom-Nom,/ })).toBeVisible()
  await expect(places.getByRole('button', { name: /^Shopping,/ })).toHaveCount(0) // categories only with pins
  // Expand down to the pin and check its green (revisit) status.
  await places.getByRole('button', { name: /^Nom-Nom,/ }).click()
  await places.getByRole('button', { name: /^Vietnamese,/ }).click()
  await places.getByRole('button', { name: /^Phở,/ }).click()
  await expect(places.getByText('Phở Hòa Pasteur')).toBeVisible()
  await expect(places.getByRole('img', { name: 'Visited: revisit' })).toBeVisible()

  const pin = JSON.parse(db.calls.find(c => c.method === 'POST' && c.path === '/rest/v1/pins')!.body!)
  expect(pin).toMatchObject({
    trip_id: 'trip-saigon', google_place_id: 'g-pho', name: 'Phở Hòa Pasteur', lat: 10.789, lng: 106.689,
    category: 'food', subcategory: 'vietnamese', subsubcategory: 'pho', michelin: 'mentioned', michelin_year: 2026, street_food: true, fine_dining: false
  })
  const review = JSON.parse(db.calls.find(c => c.method === 'POST' && c.path === '/rest/v1/pin_reviews')!.body!)
  expect(review).toEqual({ pin_id: pin.id, user_id: ME, status: 'vis', verdict: 'revisit', rating: 4.5 })
})

test('the tree: collapses by category, MICHELIN chip, Show all pins on by default; edit shows everyone and the average', async ({ page }) => {
  const db = await fakeSupabase(page, {
    pins: SAVED_PINS,
    reviews: [
      { pin_id: 'pin-pho', user_id: ME, status: 'vis', verdict: 'revisit', rating: 5, updated_at: '2026-10-01T10:00:00Z' },
      { pin_id: 'pin-pho', user_id: FRIEND, status: 'vis', verdict: 'no', rating: 2.5, updated_at: '2026-10-03T10:00:00Z' }
    ]
  })
  await fakePlaces(page, [MARKET])
  await page.goto('./wander/trip/trip-saigon')
  const places = page.getByRole('complementary', { name: 'Places' })
  // Collapsed by default: just the categories with pins.
  await expect(places.getByRole('button', { name: /^Nom-Nom, 2 pins/ })).toBeVisible()
  await expect(places.getByRole('button', { name: /^Shopping, 1 pin/ })).toBeVisible()
  await expect(places.getByRole('button', { name: /^Accommodation/ })).toHaveCount(0)
  await expect(places.getByText('Phở Hòa Pasteur')).toHaveCount(0) // leaves hidden until expanded
  await expect(places.getByLabel('Show all pins')).toBeChecked()
  await expect(places.getByRole('button', { name: 'MICHELIN 2' })).toHaveAttribute('aria-pressed', 'false')

  // Expand down: Phở (dish) holds pin-pho; Anan sits directly under Vietnamese (no dish).
  await places.getByRole('button', { name: /^Nom-Nom,/ }).click()
  await places.getByRole('button', { name: /^Vietnamese,/ }).click()
  await expect(places.getByText('Anan Saigon')).toBeVisible()
  await places.getByRole('button', { name: /^Phở,/ }).click()
  // Most recent VIS wins: Mai's ✗ is newer than Hanh's ✓.
  await expect(places.getByRole('img', { name: "Visited: don't go back" })).toBeVisible()

  await places.getByText('Phở Hòa Pasteur').click()
  const card = places.getByRole('form', { name: 'Edit place' })
  await expect(card.getByRole('radio', { name: /Revisit/ })).toHaveAttribute('aria-checked', 'true')
  const everyone = card.getByRole('group', { name: 'Everyone on the trip' })
  await expect(everyone.getByRole('listitem')).toHaveCount(2)
  await expect(everyone.getByText('Mai')).toBeVisible()
  await expect(everyone.getByText('Average 3.8 of 5 (2 ratings)')).toBeVisible()
  await card.getByLabel('Note').fill('Go before 9')
  await card.getByRole('button', { name: 'Save' }).click()
  await expect(places.getByRole('form')).toHaveCount(0)
  const patch = db.calls.find(c => c.method === 'PATCH' && c.path === '/rest/v1/pins')!
  expect(JSON.parse(patch.body!)).toMatchObject({ note: 'Go before 9' })
  expect(patch.url).toContain('id=eq.pin-pho')
  // Your own review didn't change, so it isn't re-sent.
  expect(db.calls.some(c => c.method === 'POST' && c.path === '/rest/v1/pin_reviews')).toBe(false)

  // Searching for a place that's already pinned opens it.
  await places.getByRole('searchbox').fill('ben thanh')
  await places.getByRole('button', { name: 'Search' }).click()
  await expect(places.getByText('Already pinned · open it')).toBeVisible()
  await places.getByRole('button', { name: /Bến Thành Market/ }).first().click()
  await expect(places.getByRole('form', { name: 'Edit place' }).getByLabel('Name')).toHaveValue('Bến Thành Market')

  // Delete asks first; the Shopping branch then disappears.
  await places.getByRole('button', { name: 'Delete' }).click()
  await places.getByRole('alert').getByRole('button', { name: 'Delete' }).click()
  await expect(places.getByRole('button', { name: /^Shopping,/ })).toHaveCount(0)
  await expect.poll(() => db.pins.map(p => p.id)).toEqual(['pin-pho', 'pin-anan'])
})

test('pin helpers: badge, average, look, and the drawing', async () => {
  const { pinBadge, averageRating } = await import('../../src/lib/pinRules')
  const { pinLook, CATEGORIES } = await import('../../src/lib/pinCatalog')
  const r = (user_id: string, status: 'wtg' | 'vis', verdict: 'revisit' | 'second' | 'no' | null, updated_at: string, rating: number | null = null) =>
    ({ pin_id: 'p', user_id, status, verdict, rating, updated_at })
  expect(pinBadge([])).toBe('wtg')
  expect(pinBadge([r('a', 'wtg', null, '2026-10-05')])).toBe('wtg')
  expect(pinBadge([r('a', 'vis', 'revisit', '2026-10-01'), r('b', 'vis', 'second', '2026-10-02'), r('c', 'wtg', null, '2026-10-09')])).toBe('second')
  expect(averageRating([r('a', 'vis', 'revisit', 'x', 4.5), r('b', 'vis', 'no', 'x', 2), r('c', 'wtg', null, 'x')])).toBe(3.3)
  expect(averageRating([])).toBeNull()

  expect(pinLook({ category: 'food', subcategory: 'vietnamese', subsubcategory: 'banh-mi' })).toMatchObject({ color: '#D85A30', icon: 'banh_mi', label: 'Nom-Nom › Vietnamese › Bánh mì' })
  expect(pinLook({ category: 'attraction', subcategory: 'worship', subsubcategory: 'temple-pagoda' })).toMatchObject({ color: '#982F69', icon: 'temple_buddhist' })
  expect(pinLook({ category: 'airport', subcategory: null, subsubcategory: null })).toMatchObject({ color: '#7F77DD', icon: 'flight' })
  // Every key is unique within its level.
  for (const c of CATEGORIES) {
    expect(new Set(c.subs.map(s => s.key)).size).toBe(c.subs.length)
    for (const s of c.subs) if (s.leaves) expect(new Set(s.leaves.map(l => l.key)).size).toBe(s.leaves.length)
  }
})

test('pin drawing: teardrop, MICHELIN flower and stars chip, status badge', async ({ page }) => {
  await fakeSupabase(page, { pins: SAVED_PINS, reviews: [{ pin_id: 'pin-anan', user_id: FRIEND, status: 'vis', verdict: 'second', rating: null, updated_at: '2026-10-02T10:00:00Z' }] })
  await page.goto('./wander/trip/trip-saigon')
  const places = page.getByRole('complementary', { name: 'Places' })
  // The tree collapses again after each edit, so expand the path each time.
  const preview = async (expand: RegExp[], leaf: string) => {
    for (const n of expand) await places.getByRole('button', { name: n }).click()
    await places.getByText(leaf, { exact: true }).click()
    const html = await places.locator('[class*="preview"]').innerHTML()
    await places.getByRole('button', { name: 'Cancel' }).click()
    return html
  }
  // 1-star MICHELIN: 36 px red pin, our flower, stars chip, yellow badge (2nd chance).
  const anan = await preview([/^Nom-Nom,/, /^Vietnamese,/], 'Anan Saigon')
  expect(anan).toContain('fill="#9E2A2B"')
  expect(anan).toContain('width="36"')
  expect(anan).toMatch(/>★<\/span>/)
  expect(anan).toContain('#F2C230')
  // Mentioned: MICHELIN pin, no chip.
  const pho = await preview([/^Nom-Nom,/, /^Vietnamese,/, /^Phở,/], 'Phở Hòa Pasteur')
  expect(pho).toContain('fill="#9E2A2B"')
  expect(pho).not.toContain('★')
  // Shopping market: 33 px, its own colour, orange WTG badge.
  const market = await preview([/^Shopping,/, /^Market,/], 'Bến Thành Market')
  expect(market).toContain('fill="#548120"')
  expect(market).toContain('width="33"')
  expect(market).toContain('#E8862A')
})

test('pin tree + title case helpers', async () => {
  const { buildPinTree, titleCase } = await import('../../src/lib/pinCatalog')
  type P = { id: string; category: string; subcategory: string | null; subsubcategory: string | null }
  const p = (id: string, category: string, subcategory: string | null, subsubcategory: string | null): P => ({ id, category, subcategory, subsubcategory })
  const tree = buildPinTree<P>([
    p('1', 'food', 'vietnamese', 'pho'),
    p('2', 'food', 'vietnamese', 'pho'),
    p('3', 'food', 'vietnamese', null), // no dish → directly under Vietnamese
    p('4', 'food', 'japanese', null),
    p('5', 'shopping', 'market', null),
    p('6', 'attraction', 'worship', 'temple-pagoda')
  ])
  // Catalogue order: Nom-Nom (food) first, then attraction, shopping.
  expect(tree.map(n => n.label)).toEqual(['Nom-Nom', 'Attraction', 'Shopping'])
  const food = tree[0]
  expect(food.count).toBe(4)
  const viet = food.children.find(n => n.label === 'Vietnamese')!
  expect(viet.count).toBe(3)
  expect(viet.children.map(n => n.label)).toEqual(['Phở']) // only the dish with pins
  expect(viet.children[0].count).toBe(2)
  expect(viet.pins.map(x => x.id)).toEqual(['3']) // the dishless pin sits on Vietnamese
  // Only branches with pins appear.
  expect(food.children.map(n => n.label)).toEqual(['Vietnamese', 'Japanese'])

  expect(titleCase('phở hòa pasteur')).toBe('Phở Hòa Pasteur')
  expect(titleCase('ANAN SAIGON')).toBe('Anan Saigon')
  expect(titleCase('bánh mì huỳnh hoa')).toBe('Bánh Mì Huỳnh Hoa')
  expect(titleCase("l'usine")).toBe("L'Usine")
})
