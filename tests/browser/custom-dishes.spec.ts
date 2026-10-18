import { test, expect, type Page } from '@playwright/test'
import { fakeSupabase } from './fake-supabase'
import { categoryOf, customDishKey, pinLook, setCustomDishes } from '../../src/lib/pinCatalog'
import { buildCountryTree } from '../../src/lib/savorTree'

// Session 14: "+ Add a new dish…" under Main dish adds the typed dish to that
// cuisine's list only (migration 0017), shared, A–Z, with the cuisine's icon.

test('added dishes join their cuisine only', () => {
  expect(customDishKey('Bún Mắm')).toBe('x-bun-mam')
  setCustomDishes([{ cuisine: 'vietnamese', key: 'x-bun-mam', label: 'Bún Mắm' }, { cuisine: 'fusion', key: 'x-pho-burrito', label: 'Phở Burrito' }])
  const food = categoryOf('food')!
  const vn = food.subs.find(s => s.key === 'vietnamese')!
  expect(vn.leaves!.length).toBe(29)
  expect(vn.leaves!.find(l => l.key === 'x-bun-mam')).toMatchObject({ label: 'Bún Mắm', icon: vn.icon, custom: true })
  expect(food.subs.find(s => s.key === 'thai')!.leaves!.some(l => l.key === 'x-bun-mam')).toBe(false)
  expect(food.subs.find(s => s.key === 'fusion')!.leaves!.map(l => l.label)).toEqual(['Phở Burrito'])
  expect(pinLook({ category: 'food', subcategory: 'vietnamese', subsubcategory: 'x-bun-mam' }).label).toBe('Nom-Nom › Vietnamese › Bún Mắm')
  const tree = buildCountryTree([{ id: 'e', cuisine: 'vietnamese', dish: 'x-bun-mam', name: 'Bún Mắm Cô Ba' }] as never[])
  expect(tree[0].dishes.map(d => d.label)).toEqual(['Bún Mắm'])
  // Setting again replaces, never duplicates; an empty list restores the built-in lists.
  setCustomDishes([{ cuisine: 'vietnamese', key: 'x-bun-mam', label: 'Bún Mắm' }])
  expect(vn.leaves!.length).toBe(29)
  setCustomDishes([])
  expect(vn.leaves!.length).toBe(28)
  expect(food.subs.find(s => s.key === 'fusion')!.leaves).toBeUndefined()
})

async function fakeGoogle(page: Page) {
  await page.route('https://places.googleapis.com/**', route =>
    route.request().method() === 'POST'
      ? route.fulfill({ json: { places: [{ id: 'gp-bm', displayName: { text: 'Bún Mắm Cô Ba' }, formattedAddress: 'Hồ Chí Minh', location: { latitude: 10.77, longitude: 106.69 } }] } })
      : route.fulfill({ json: { photos: [] } }))
}

test('type a new main dish on the eatery card', async ({ page }, info) => {
  test.skip(info.project.name === 'phone', 'computer Munch List; the phone uses the same card')
  const db = await fakeSupabase(page, { eateries: [], customDishes: [{ cuisine: 'thai', key: 'x-boat-noodles', label: 'Boat Noodles' }] })
  await fakeGoogle(page)
  await page.goto('./savor')
  const side = page.getByRole('complementary', { name: 'Catalogue' })
  await side.getByRole('searchbox', { name: /Search Google/ }).fill('bun mam')
  await side.getByRole('button', { name: 'Search' }).click()
  await side.getByRole('button', { name: /Bún Mắm Cô Ba/ }).first().click()
  const form = side.getByRole('form', { name: 'Add an eatery' })

  // Someone's Thai dish shows under Thai only.
  await form.getByLabel('Cuisine (country)').selectOption({ label: 'Thai' })
  await expect(form.getByLabel('Main dish').locator('option', { hasText: 'Boat Noodles' })).toHaveCount(1)
  await form.getByLabel('Cuisine (country)').selectOption({ label: 'Vietnamese' })
  await expect(form.getByLabel('Main dish').locator('option', { hasText: 'Boat Noodles' })).toHaveCount(0)

  // Typing an existing dish picks it instead of adding a copy.
  await form.getByLabel('Main dish').selectOption({ label: '+ Add a new dish…' })
  await form.getByLabel('New dish').fill('bun bo hue')
  await form.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(form.getByLabel('Main dish')).toHaveValue('bun-bo-hue')
  expect(db.customDishes).toHaveLength(1)

  // A new dish is added to Vietnamese, picked, and listed A–Z.
  await form.getByLabel('Main dish').selectOption({ label: '+ Add a new dish…' })
  await form.getByLabel('New dish').fill('bún mắm')
  await expect(form.getByText('Adds to Vietnamese as: Bún Mắm')).toBeVisible()
  await form.getByLabel('New dish').press('Enter')
  await expect(form.getByLabel('Main dish')).toHaveValue('x-bun-mam')
  expect(db.customDishes).toContainEqual({ cuisine: 'vietnamese', key: 'x-bun-mam', label: 'Bún Mắm' })
  const opts = (await form.getByLabel('Main dish').locator('option').allTextContents()).slice(2) // after the placeholder and "+ Add a new dish…"
  expect((await form.getByLabel('Main dish').locator('option').allTextContents())[1]).toBe('+ Add a new dish…')
  expect(opts).toContain('Bún Mắm')
  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })
  expect(opts).toEqual([...opts].sort(collator.compare))

  // Fusion has no built-in list but still offers "+ Add a new dish…".
  await form.getByLabel('Cuisine (country)').selectOption({ label: 'Fusion' })
  await expect(form.getByLabel('Main dish').locator('option')).toHaveText(['Main dish (optional)', '+ Add a new dish…'])
  await form.getByLabel('Cuisine (country)').selectOption({ label: 'Vietnamese' })
  await form.getByLabel('Main dish').selectOption({ label: 'Bún Mắm' })
  await form.getByRole('button', { name: 'Add eatery' }).click()
  await expect.poll(() => db.eateries.length).toBe(1)
  expect(db.eateries[0]).toMatchObject({ cuisine: 'vietnamese', dish: 'x-bun-mam' })
})
