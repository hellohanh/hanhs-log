import { test, expect } from '@playwright/test'
import { fakeSupabase, ME } from './fake-supabase'

// Wanderlog trip list (/wander), against the stand-in Supabase in
// fake-supabase.ts (never the live database).

test('signed out: asks you to sign in', async ({ page }) => {
  await fakeSupabase(page, { signedInAs: null })
  await page.goto('./wander')
  await expect(page.getByText('Sign in to see your trips')).toBeVisible()
  await expect(page.getByRole('main').getByRole('link', { name: 'Sign in' })).toBeVisible()
})

test('shows upcoming trips soonest first, then past trips', async ({ page }) => {
  await fakeSupabase(page)
  await page.goto('./wander')

  const upcoming = page.locator('ul').first().getByTestId('trip-card')
  await expect(upcoming).toHaveCount(3)
  await expect(upcoming.nth(0)).toContainText('Christmas in Saigon')
  await expect(upcoming.nth(0)).toContainText('Dec 18 – Jan 2, 2027')
  await expect(upcoming.nth(0)).toContainText('42 pins · 3 people')
  await expect(upcoming.nth(0)).toContainText('You own this')
  await expect(upcoming.nth(1)).toContainText('Rome long weekend')
  await expect(upcoming.nth(1)).toContainText('Mar 12 – Mar 16, 2027')
  await expect(upcoming.nth(1)).toContainText('Shared with you')
  await expect(upcoming.nth(2)).toContainText('Japan in spring')
  await expect(upcoming.nth(2)).toContainText('No dates yet')
  await expect(upcoming.nth(2)).toContainText('1 pin · just you')

  await expect(page.getByRole('heading', { name: 'Past' })).toBeVisible()
  const past = page.locator('ul').nth(1).getByTestId('trip-card')
  await expect(past).toHaveCount(1)
  await expect(past.first()).toContainText('Jul 3 – Jul 10, 2025')

  // Only the owner gets a delete button.
  await expect(page.getByRole('button', { name: 'Delete Christmas in Saigon' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete Rome long weekend' })).toHaveCount(0)

  // A card opens its trip page.
  await page.getByRole('link', { name: 'Christmas in Saigon' }).click()
  await expect(page).toHaveURL(/\/wander\/trip\/trip-saigon$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Christmas in Saigon')
})

test('creates a trip, and checks the name and destination first', async ({ page }) => {
  const { calls } = await fakeSupabase(page)
  await page.goto('./wander')
  await page.getByRole('button', { name: 'New trip' }).click()

  await page.getByRole('button', { name: 'Create trip' }).click()
  await expect(page.getByRole('alert')).toHaveText('Give the trip a name and a destination.')

  await page.getByLabel('Trip name').fill('  Hà Nội in autumn ')
  await page.getByLabel('Destination').fill('Hà Nội, Vietnam')
  await page.getByLabel('Start (optional)').fill('2026-11-02')
  await page.getByLabel('End (optional)').fill('2026-11-01')
  await page.getByRole('button', { name: 'Create trip' }).click()
  await expect(page.getByRole('alert')).toHaveText('The end date is before the start date.')

  await page.getByLabel('End (optional)').fill('2026-11-09')
  await page.getByRole('button', { name: 'Create trip' }).click()

  await expect(page.getByText('Created "Hà Nội in autumn".')).toBeVisible()
  const insert = calls.find(c => c.method === 'POST' && c.url.includes('/rest/v1/trips'))
  const body = JSON.parse(insert!.body!)
  // The app picks the new trip's id so it can save the trip's city right away.
  expect(body.id).toMatch(/^[0-9a-f-]{36}$/)
  delete body.id
  expect(body).toEqual({
    name: 'Hà Nội in autumn',
    destination: 'Hà Nội, Vietnam',
    start_date: '2026-11-02',
    end_date: '2026-11-09',
    owner_id: ME
  })
  // The new trip is the soonest, so it comes first.
  await expect(page.getByTestId('trip-card').first()).toContainText('Hà Nội in autumn')
  await expect(page.getByTestId('trip-card').first()).toContainText('Nov 2 – Nov 9')
})

test('deletes a trip only after you confirm', async ({ page }) => {
  const { calls } = await fakeSupabase(page)
  await page.goto('./wander')

  page.once('dialog', d => d.dismiss())
  await page.getByRole('button', { name: 'Delete Japan in spring' }).click()
  expect(calls.some(c => c.method === 'DELETE')).toBe(false)

  page.once('dialog', d => {
    expect(d.message()).toContain('Delete "Japan in spring" and everything in it')
    d.accept()
  })
  await page.getByRole('button', { name: 'Delete Japan in spring' }).click()
  await expect(page.getByText('Deleted "Japan in spring".')).toBeVisible()
  await expect(page.getByTestId('trip-card').filter({ hasText: 'Japan in spring' })).toHaveCount(0)
  const del = calls.find(c => c.method === 'DELETE')
  expect(del!.url).toContain('id=eq.trip-undated')
})

test('a database error is shown, not a blank page', async ({ page }) => {
  await fakeSupabase(page)
  await page.route('https://test-project.supabase.co/rest/v1/trips**', route =>
    route.fulfill({ status: 500, json: { message: 'something broke' } })
  )
  await page.goto('./wander')
  await expect(page.getByRole('alert')).toContainText("Couldn't load your trips")
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})
