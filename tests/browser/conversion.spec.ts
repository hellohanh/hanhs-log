import { test, expect, type Page } from '@playwright/test'
import { fakeSupabase } from './fake-supabase'

// Conversion (session 20, Hanh): the trip's country currency on top, USD
// below, typing in either fills in the other; blank on top when not opened
// from a trip; Change picks another for this visit; rates kept on the device
// so it works offline. Rates are a fixed test reply (1 USD = 26,000 VND).

const now = Math.floor(Date.now() / 1000)
const RATES = { result: 'success', time_last_update_unix: now - 3600, time_next_update_unix: now + 82800, rates: { USD: 1, VND: 26000, JPY: 155, EUR: 0.92, THB: 34 } }

async function rates(page: Page) {
  let calls = 0
  await page.route(/open\.er-api\.com/, route => { calls++; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RATES) }) })
  return () => calls
}

test('from a trip: the trip country on top, both boxes fill each other', async ({ page }) => {
  await rates(page)
  await fakeSupabase(page)
  await page.goto('./convert?trip=trip-saigon')
  await expect(page.getByText('VND', { exact: true })).toBeVisible()
  await expect(page.getByText('1 USD = 26,000 VND')).toBeVisible()
  await page.getByLabel(/Vietnamese dong amount/i).fill('100000')
  await expect(page.getByLabel('US dollar amount')).toHaveValue('3.85')
  await page.getByLabel('US dollar amount').fill('10')
  await expect(page.getByLabel(/Vietnamese dong amount/i)).toHaveValue('260,000')
  await expect(page.getByRole('link', { name: 'Rates by ExchangeRate-API' })).toBeVisible()
})

test('a trip in another country uses its currency', async ({ page }) => {
  await rates(page)
  await fakeSupabase(page)
  await page.goto('./convert?trip=trip-undated')
  await expect(page.getByText('JPY', { exact: true })).toBeVisible()
})

test('not from a trip: top starts blank, Change picks one for this visit', async ({ page }) => {
  await rates(page)
  await fakeSupabase(page)
  await page.goto('./convert')
  await expect(page.getByText('No currency picked')).toBeVisible()
  await expect(page.getByPlaceholder('Choose a currency first')).toBeDisabled()
  await page.getByRole('button', { name: 'Choose' }).click()
  await page.getByRole('searchbox', { name: 'Search currencies' }).fill('baht')
  await page.getByRole('button', { name: /Thai baht/i }).click()
  await page.getByLabel('US dollar amount').fill('2')
  await expect(page.getByLabel(/Thai baht amount/i)).toHaveValue('68.00')
  // This visit only: a fresh visit starts blank again.
  await page.goto('./convert')
  await expect(page.getByText('No currency picked')).toBeVisible()
})

test('rates are fetched once a day and kept for offline use', async ({ page, context }) => {
  const calls = await rates(page)
  await fakeSupabase(page)
  await page.goto('./convert?trip=trip-saigon')
  await expect(page.getByText('1 USD = 26,000 VND')).toBeVisible()
  await page.reload()
  await expect(page.getByText('1 USD = 26,000 VND')).toBeVisible()
  expect(calls()).toBe(1)
  await context.setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  await expect(page.getByText(/offline: last rates kept on this device/)).toBeVisible()
})

test('the ☰ carries the trip to Conversion on phones; Your trips ☰ has it on a computer', async ({ page }, info) => {
  await rates(page)
  await fakeSupabase(page)
  if (info.project.name === 'phone') {
    await page.goto('./wander/trip/trip-saigon')
    await page.getByRole('button', { name: 'Menu', exact: true }).click()
    await page.getByRole('link', { name: 'Conversion' }).click()
    await expect(page).toHaveURL(/\/convert\?trip=trip-saigon/)
    await expect(page.getByText('VND', { exact: true })).toBeVisible()
  } else if (info.project.name === 'laptop') {
    await page.goto('./wander')
    await page.getByRole('button', { name: 'More trip actions' }).click()
    await page.getByRole('menuitem', { name: 'Conversion' }).click()
    await expect(page).toHaveURL(/\/convert$/)
  } else test.skip()
})
