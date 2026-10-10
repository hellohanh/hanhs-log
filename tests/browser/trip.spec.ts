import { test, expect } from '@playwright/test'
import { fakeSupabase, FRIEND } from './fake-supabase'

// The trip page, Share & people, the first-name prompt and invite links,
// against the stand-in Supabase in fake-supabase.ts.

test('trip page shows the trip, its dates and the people on it', async ({ page }) => {
  await fakeSupabase(page)
  await page.goto('./wander/trip/trip-saigon')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Christmas in Saigon')
  await expect(page.getByText('Hồ Chí Minh City · Vietnam · Dec 18 – Jan 2, 2027')).toBeVisible()
  await expect(page.getByRole('button', { name: '3 people on this trip' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tab', { name: /Itinerary/ })).toBeDisabled()
})

test('a trip you are not on says so instead of breaking', async ({ page }) => {
  await fakeSupabase(page)
  await page.goto('./wander/trip/not-mine')
  await expect(page.getByText("Can't open this trip")).toBeVisible()
})

test('edit trip saves name, Country, cities and dates with the same form as New trip', async ({ page }) => {
  const db = await fakeSupabase(page)
  await page.goto('./wander/trip/trip-saigon')
  await expect(page.getByText('Hồ Chí Minh City · Vietnam · Dec 18 – Jan 2, 2027')).toBeVisible()
  await page.getByRole('button', { name: 'Edit trip' }).click()
  const form = page.getByRole('form', { name: 'Edit trip' })
  await expect(form.getByLabel('Country')).toHaveValue('Vietnam')
  await expect(form.getByLabel('Primary City')).toHaveValue('Hồ Chí Minh City')
  await form.getByLabel('Trip name').fill('Tết in Saigon')
  await form.getByLabel('Primary City').fill('')
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form.getByRole('alert')).toHaveText('Add a Country and a Primary City.')
  await form.getByLabel('Primary City').fill('Hồ Chí Minh City')
  await form.getByLabel('Tertiary City').fill('Vũng Tàu')
  await form.getByLabel('End').fill('2026-12-01')
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form.getByRole('alert')).toHaveText('The end date is before the start date.')
  await form.getByLabel('End').fill('2027-02-20')
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tết in Saigon')
  await expect(page.getByText('Hồ Chí Minh City, Vũng Tàu · Vietnam', { exact: false })).toBeVisible()
  const patch = db.calls.find(c => c.method === 'PATCH')
  expect(JSON.parse(patch!.body!)).toEqual({
    name: 'Tết in Saigon', country: 'Vietnam', city_primary: 'Hồ Chí Minh City', city_secondary: null, city_tertiary: 'Vũng Tàu',
    start_date: '2026-12-18', end_date: '2027-02-20'
  })
  expect(patch!.url).toContain('id=eq.trip-saigon')
})

test('owner: share & people shows the link, names, remove and reset', async ({ page }) => {
  const db = await fakeSupabase(page)
  await page.goto('./wander/trip/trip-saigon')
  await page.getByRole('button', { name: 'Share & people' }).click()
  const dialog = page.getByRole('dialog', { name: 'Share & people' })
  await expect(dialog).toBeVisible()

  await expect(dialog.getByLabel('Invite link')).toHaveValue(/\/wander\/join\/tok-saigon$/)
  const people = dialog.getByTestId('person')
  await expect(people).toHaveCount(3)
  await expect(people.nth(0)).toContainText('Hanh (you)')
  await expect(people.nth(0)).toContainText('Owner')
  await expect(people.nth(1)).toContainText('Mai')
  await expect(people.nth(1)).toContainText('Joined Oct 2')
  await expect(people.nth(2)).toContainText('No name yet')
  await expect(people.nth(0).getByRole('button', { name: 'Remove' })).toHaveCount(0)

  // Remove asks first.
  page.once('dialog', d => d.accept())
  await people.nth(1).getByRole('button', { name: 'Remove' }).click()
  await expect(dialog.getByText('Removed Mai.')).toBeVisible()
  await expect(people).toHaveCount(2)
  const removal = db.calls.find(c => c.path.endsWith('/rpc/remove_trip_member'))
  expect(JSON.parse(removal!.body!)).toEqual({ _trip: 'trip-saigon', _user: FRIEND })

  // Reset makes a new link.
  page.once('dialog', d => d.accept())
  await dialog.getByRole('button', { name: /Reset link/ }).click()
  await expect(dialog.getByLabel('Invite link')).toHaveValue(/\/wander\/join\/tok-reset$/)
  await expect(dialog.getByText('New invite link made.')).toBeVisible()

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
})

test('member: no remove or reset buttons, but can change their own name', async ({ page }) => {
  const db = await fakeSupabase(page)
  await page.goto('./wander/trip/trip-rome')
  await page.getByRole('button', { name: 'Share & people' }).click()
  const dialog = page.getByRole('dialog', { name: 'Share & people' })
  await expect(dialog.getByTestId('person')).toHaveCount(2)
  await expect(dialog.getByRole('button', { name: 'Remove' })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: /Reset link/ })).toHaveCount(0)

  await dialog.getByRole('button', { name: 'change your name' }).click()
  await dialog.getByLabel('Your first name').fill('Hạnh')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByTestId('person').filter({ hasText: '(you)' })).toContainText('Hạnh (you)')
  expect(db.myName).toBe('Hạnh')
})

test('someone without a first name is asked for one', async ({ page }) => {
  const db = await fakeSupabase(page, { myName: null })
  await page.goto('./wander/trip/trip-saigon')
  const prompt = page.getByRole('dialog', { name: 'What should people call you?' })
  await expect(prompt).toBeVisible()
  await prompt.getByRole('button', { name: 'Save' }).click()
  await expect(prompt.getByRole('alert')).toHaveText('Type a first name.')
  await prompt.getByLabel('First name').fill('Hanh')
  await prompt.getByRole('button', { name: 'Save' }).click()
  await expect(prompt).toBeHidden()
  expect(db.myName).toBe('Hanh')
})

test('"Later" closes the name question for now', async ({ page }) => {
  await fakeSupabase(page, { myName: null })
  await page.goto('./wander/trip/trip-saigon')
  await page.getByRole('button', { name: 'Later' }).click()
  await expect(page.getByRole('dialog', { name: 'What should people call you?' })).toBeHidden()
})

test('invite link: a visitor joins without an email, then is asked for a first name', async ({ page }) => {
  const db = await fakeSupabase(page, { signedInAs: null })
  await page.goto('./wander/join/tok-saigon')
  await expect(page.getByRole('heading', { name: "You've been invited to a trip" })).toBeVisible()
  await page.getByRole('button', { name: 'Join trip' }).click()

  await expect(page).toHaveURL(/\/wander\/trip\/trip-saigon$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Christmas in Saigon')
  expect(db.calls.some(c => c.path === '/auth/v1/signup')).toBe(true)
  const join = db.calls.find(c => c.path.endsWith('/rpc/join_trip_via_invite'))
  expect(JSON.parse(join!.body!)).toEqual({ _token: 'tok-saigon' })
  await expect(page.getByRole('dialog', { name: 'What should people call you?' })).toBeVisible()
})

test('invite link: someone already signed in joins straight away', async ({ page }) => {
  await fakeSupabase(page)
  await page.goto('./wander/join/tok-rome')
  await expect(page).toHaveURL(/\/wander\/trip\/trip-rome$/)
})

test('invite link: an old or wrong link explains what to do', async ({ page }) => {
  await fakeSupabase(page)
  await page.goto('./wander/join/tok-nope')
  await expect(page.getByRole('alert')).toContainText("This invite link doesn't work")
})

test('the map area opens empty: no old pins, and says why there is no map in a build without a key', async ({ page }) => {
  await fakeSupabase(page)
  await page.goto('./wander/trip/trip-saigon')
  await expect(page.getByText('No places on this trip yet.')).toBeVisible()
  await expect(page.getByText('Old Wanderlog pins show here and on the map once you sort them.', { exact: false })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: "The map can't load in this build" })).toBeVisible()
})

test('the map looks up the Primary City in its Country; Districts within 20 km of HCMC', async () => {
  const { mapQuery, placeLabel } = await import('../../src/lib/place')
  expect(mapQuery({ country: ' Vietnam ', city_primary: 'Hồ Chí Minh City ' })).toBe('Hồ Chí Minh City, Vietnam')
  expect(placeLabel({ country: 'Vietnam', city_primary: 'Hồ Chí Minh City', city_secondary: null, city_tertiary: 'Vũng Tàu' }))
    .toBe('Hồ Chí Minh City, Vũng Tàu · Vietnam')
  const { distanceKm, HCMC_CENTRE, countryNames } = await import('../../src/lib/cityName')
  expect(countryNames()).toContain('Vietnam')
  expect(countryNames()).toContain('Italy')
  // The Districts button shows within 20 km of Ho Chi Minh City.
  expect(distanceKm(HCMC_CENTRE, { lat: 10.8188, lng: 106.6519 })).toBeLessThan(20)
  expect(distanceKm(HCMC_CENTRE, { lat: 15.8801, lng: 108.338 })).toBeGreaterThan(20)
})
