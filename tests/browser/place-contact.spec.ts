import { test, expect } from '@playwright/test'
import { fakePlaces, fakeSupabase } from './fake-supabase'

// Address, phone and website on every place's edit panel (session 16, Hanh,
// approved mockup; migration 0026): filled in from Google where nothing was
// saved ("from Google"), editable ("edited"), and a cleared field is saved as
// '' so the popup hides it ("hidden").

test('contact helpers: saved wins, never-saved shows Google, cleared hides', async () => {
  const { shownContact, openField, typedField, savedValue, websiteHref, missingContactColumns, withoutContact } = await import('../../src/lib/contact')
  expect(shownContact(null, 'Google St')).toBe('Google St')
  expect(shownContact(undefined, 'Google St')).toBe('Google St')
  expect(shownContact('My St', 'Google St')).toBe('My St')
  expect(shownContact('', 'Google St')).toBeNull()

  expect(openField('My St', 'Google St')).toEqual({ value: 'My St', source: 'saved' })
  expect(openField(null, 'Google St')).toEqual({ value: 'Google St', source: 'google' })
  expect(openField('', 'Google St')).toEqual({ value: '', source: 'hidden' })
  expect(openField(null, null)).toEqual({ value: '', source: 'none' })

  // Google's kept on Save; typed text saved trimmed; cleared → '' (hide); never had one → null.
  expect(savedValue(openField(null, 'Google St'))).toBe('Google St')
  expect(savedValue(typedField('  +84 28 1234  '))).toBe('+84 28 1234')
  expect(savedValue(typedField(''))).toBe('')
  expect(savedValue(openField(null, null))).toBeNull()
  expect(savedValue(openField('', null))).toBe('')

  expect(websiteHref('benthanh.vn')).toBe('https://benthanh.vn')
  expect(websiteHref('http://x.com')).toBe('http://x.com')
  // Before 0026 runs, the database doesn't know the columns: save the rest.
  expect(missingContactColumns({ message: "Could not find the 'phone' column of 'pins' in the schema cache" })).toBe(true)
  expect(missingContactColumns({ message: 'permission denied' })).toBe(false)
  expect(withoutContact({ name: 'A', phone: 'x', website: 'y' })).toEqual({ name: 'A' })
})

test.describe('computer edit panels', () => {
  test.beforeEach(({}, info) => { test.skip(info.project.name === 'phone', 'the phone uses the same form; checked on the larger screens') })

  test('a new place: the address comes from Google, phone and website can be typed in', async ({ page }) => {
    const db = await fakeSupabase(page)
    await fakePlaces(page, [{ id: 'g-ben-thanh', name: 'Bến Thành Market', address: 'Lê Lợi, Quận 1', lat: 10.772, lng: 106.698 }])
    await page.goto('./wander/trip/trip-saigon')
    const places = page.getByRole('complementary', { name: 'Places' })
    await places.getByRole('searchbox', { name: 'Search Google for a place to add' }).fill('ben thanh')
    await places.getByRole('button', { name: 'Search' }).click()
    await places.getByRole('button', { name: /Bến Thành Market/ }).click()
    const card = places.getByRole('form', { name: 'Add a place' })
    const address = card.getByRole('textbox', { name: /Address/ })
    await expect(address).toHaveValue('Lê Lợi, Quận 1')
    await expect(card.getByText('from Google', { exact: true })).toBeVisible()
    await card.getByRole('textbox', { name: /Phone/ }).fill('+84 28 3829 9274')
    await card.getByRole('textbox', { name: /Website/ }).fill('benthanhmarket.vn')
    await expect(card.getByText('edited', { exact: true })).toHaveCount(2)
    await card.getByLabel('Category').selectOption('shopping')
    await card.getByRole('button', { name: 'Add pin' }).click()
    await expect(places.getByRole('button', { name: /^Shopping,/ })).toBeVisible()
    const spot = JSON.parse(db.calls.find(c => c.method === 'POST' && c.path === '/rest/v1/spots')!.body!)
    expect(spot).toMatchObject({ address: 'Lê Lợi, Quận 1', phone: '+84 28 3829 9274', website: 'benthanhmarket.vn' })
  })

  test('editing a trip pin: change the phone, clear the address to hide it', async ({ page }) => {
    const PIN = {
      id: 'pin-pho', trip_id: 'trip-saigon', google_place_id: 'g-pho', name: 'Phở Hòa Pasteur', address: '260C Pasteur, Quận 3', phone: null, website: null,
      lat: 10.789, lng: 106.689, category: 'food', subcategory: 'vietnamese', subsubcategory: null, michelin: null, michelin_year: null, street_food: false, fine_dining: false, note: null
    }
    const db = await fakeSupabase(page, { pins: [PIN] })
    await page.goto('./wander/trip/trip-saigon')
    const places = page.getByRole('complementary', { name: 'Places' })
    await places.getByRole('button', { name: /^Nom-Nom,/ }).click()
    await places.getByRole('button', { name: /^Vietnamese,/ }).click()
    await places.getByText('Phở Hòa Pasteur').dblclick()
    const card = places.getByRole('form', { name: 'Edit place' })
    const address = card.getByRole('textbox', { name: /Address/ })
    await expect(address).toHaveValue('260C Pasteur, Quận 3')
    await expect(card.getByText('from Google', { exact: true })).toHaveCount(0)
    await card.getByRole('textbox', { name: /Phone/ }).fill('028 3829 7943')
    await address.fill('')
    await expect(card.getByText('hidden', { exact: true })).toBeVisible()
    await card.getByRole('button', { name: 'Save' }).click()
    await expect(card).toHaveCount(0)
    expect(db.pins.find(p => p.id === 'pin-pho')).toMatchObject({ address: '', phone: '028 3829 7943', website: null })
  })

  test('a Munch List eatery: a hidden phone stays hidden, the website can be added', async ({ page }) => {
    const EATERY = {
      id: 'e1', google_place_id: 'gp1', name: 'Phở Hòa Pasteur', address: 'Quận 3', phone: '', website: null, lat: 10.789, lng: 106.689, cuisine: 'vietnamese', dish: 'pho',
      michelin: null, michelin_year: null, street_food: false, fine_dining: false, price: 2, note: null, deleted_at: null
    }
    const db = await fakeSupabase(page, { eateries: [EATERY] })
    await page.goto('./savor')
    const side = page.getByRole('complementary', { name: 'Catalogue' })
    await side.getByRole('button', { name: /^Vietnamese/ }).click()
    await side.getByRole('button', { name: /^Phở \d/ }).click()
    await side.getByText('Phở Hòa Pasteur').dblclick()
    const card = side.getByRole('form', { name: 'Edit eatery' })
    await expect(card.getByRole('textbox', { name: /Phone/ })).toHaveValue('')
    await expect(card.getByText('hidden', { exact: true })).toBeVisible()
    await card.getByRole('textbox', { name: /Website/ }).fill('phohoa.vn')
    await card.getByRole('button', { name: 'Save' }).click()
    await expect(card).toHaveCount(0)
    expect(db.eateries.find(e => e.id === 'e1')).toMatchObject({ address: 'Quận 3', phone: '', website: 'phohoa.vn' })
  })
})
