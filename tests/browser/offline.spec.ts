import { test, expect } from '@playwright/test'
import { fakeSupabase } from './fake-supabase'

// Offline step 1 (session 15, approved mockup): what you've opened is kept on
// the device; with no signal the page shows the saved copy under the dark
// "Offline · showing what was saved …" line. Trips you haven't opened yet
// say so instead.

const PIN = { id: 'pin-pho', trip_id: 'trip-saigon', google_place_id: 'g-pho', name: 'Phở Hòa Pasteur', address: null, lat: 10.789, lng: 106.689, category: 'food', subcategory: 'vietnamese', subsubcategory: 'pho', michelin: null, michelin_year: null, street_food: false, fine_dining: false, note: null }

test('no signal: a trip you opened shows from the saved copy; one you didn\'t says so', async ({ page, context }, info) => {
  await fakeSupabase(page, { pins: [PIN] })
  await page.goto('./wander')
  await expect(page.getByRole('link', { name: 'Christmas in Saigon' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Offline' })).toHaveCount(0)
  // Open the trip once with signal, then go back to the list.
  await page.getByRole('link', { name: 'Christmas in Saigon' }).click()
  await expect(page.getByRole('heading', { name: 'Christmas in Saigon' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('link', { name: 'Rome long weekend' })).toBeVisible()

  await context.setOffline(true)
  await page.getByRole('link', { name: 'Christmas in Saigon' }).click()
  const line = page.getByRole('status').filter({ hasText: 'Offline' })
  await expect(line).toContainText(/Offline · showing what was saved \w{3} \d{1,2}:\d{2}/)
  await expect(page.getByRole('heading', { name: 'Christmas in Saigon' })).toBeVisible()
  if (info.project.name !== 'phone') {
    const places = page.getByRole('complementary', { name: 'Places' })
    await expect(places.getByRole('button', { name: /^Nom-Nom, 1 pin/ })).toBeVisible()
  }

  // A trip never opened on this device: the line says it wasn't saved.
  await page.goBack()
  await page.getByRole('link', { name: 'Rome long weekend' }).click()
  await expect(line).toContainText(/wasn't saved on this device yet|weren't saved yet/)

  // Back online: the next read works and the line goes.
  await context.setOffline(false)
  await page.goBack()
  await page.getByRole('link', { name: 'Christmas in Saigon' }).click()
  await expect(line).toHaveCount(0)
})

test('offline helpers: which calls are kept, who is asking, the time label', async () => {
  const { isSavedRead, userOf, savedLabel } = await import('../../src/lib/offline')
  expect(isSavedRead('GET', '/rest/v1/pins')).toBe(true)
  expect(isSavedRead('POST', '/rest/v1/rpc/trip_people')).toBe(true)
  expect(isSavedRead('POST', '/rest/v1/rpc/copy_trip_pins')).toBe(false)
  expect(isSavedRead('PATCH', '/rest/v1/pins')).toBe(false)
  expect(isSavedRead('GET', '/auth/v1/user')).toBe(false)
  const jwt = (sub: string) => `x.${btoa(JSON.stringify({ sub })).replace(/=+$/, '')}.y`
  expect(userOf(new Headers({ Authorization: `Bearer ${jwt('u-1')}` }))).toBe('u-1')
  expect(userOf(new Headers({ Authorization: 'Bearer not-a-token' }))).toBe('anon')
  const d = new Date(2026, 9, 20, 9, 42)
  expect(savedLabel(d.toISOString())).toBe('Tue 9:42')
})
