import { test, expect, type Page } from '@playwright/test'
import { fakeSupabase, setTime } from './fake-supabase'

// The phone layout (session 10, approved mockups at 412 × 891): a slim header
// with ☰, and on a trip the map with Places / Itinerary bottom sheets. Runs
// on the phone size; the last test checks the desktop sizes never show it.

const pin = (id: string, name: string, category: string, sub: string | null = null) =>
  ({ id, trip_id: 'trip-saigon', google_place_id: `g-${id}`, name, address: null, lat: 10.77, lng: 106.69, category, subcategory: sub, subsubcategory: null, michelin: null, michelin_year: null, street_food: false, fine_dining: false, note: null })
const PINS = [pin('h', 'Hotel Des Arts', 'accommodation', 'hotel'), pin('m', 'Bến Thành Market', 'shopping', 'market')]

const onlyPhone = () => test.beforeEach(({}, info) => { test.skip(info.project.name !== 'phone', 'phone layout') })

async function openTrip(page: Page) {
  await page.goto('./wander/trip/trip-saigon')
  await expect(page.getByRole('heading', { level: 1, name: 'Christmas in Saigon' })).toBeVisible()
}

test.describe('phone', () => {
  onlyPhone()

  test('slim header: Hanh\'s Log and a ☰ menu with the sections, dark mode and sign out', async ({ page }) => {
    await fakeSupabase(page)
    await page.goto('./wander')
    await expect(page.getByRole('link', { name: "Hanh's Log" })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Savorlog' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Menu', exact: true }).click()
    const menu = page.getByRole('navigation', { name: 'Sections' })
    await expect(menu.getByRole('link')).toHaveText(['Wanderlog', 'Savorlog'])
    await expect(menu.getByRole('button', { name: /Dark mode|Light mode/ })).toBeVisible()
    await expect(menu.getByRole('button', { name: 'Sign out' })).toBeVisible()
    await menu.getByRole('link', { name: 'Savorlog' }).click()
    await expect(page).toHaveURL(/\/savor/)
  })

  test('a trip is the map: one title bar, the Itinerary sheet at half, the bottom bar', async ({ page }) => {
    await fakeSupabase(page, { pins: PINS })
    await openTrip(page)
    // The site header merges into the trip's title bar.
    await expect(page.locator('header').filter({ hasText: "Hanh's Log" })).toHaveCount(0)
    await expect(page.getByText('Dec 18 – Jan 2, 2027 · 3 people')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeVisible()
    const views = page.getByRole('navigation', { name: 'Trip views' })
    await expect(views.getByRole('button', { name: 'Itinerary' })).toHaveAttribute('aria-pressed', 'true')
    const itin = page.getByRole('region', { name: 'Itinerary' })
    await expect(itin).toHaveAttribute('data-snap', 'half')
    // Before the trip starts it opens on the first day; days are one row.
    await expect(itin.getByRole('tab', { selected: true })).toContainText('Dec 18')
    const tabs = itin.getByRole('tablist', { name: 'Days' })
    expect(await tabs.evaluate(el => getComputedStyle(el).flexWrap)).toBe('nowrap')
  })

  test('during the trip it opens on today', async ({ page }) => {
    await fakeSupabase(page)
    await page.clock.setFixedTime(new Date('2026-12-25T10:00:00'))
    await openTrip(page)
    await expect(page.getByRole('region', { name: 'Itinerary' }).getByRole('tab', { selected: true })).toContainText('Dec 25')
  })

  test('the bottom bar swaps sheets; tapping the open one drops it; the handle steps up', async ({ page }) => {
    await fakeSupabase(page, { pins: PINS })
    await openTrip(page)
    const views = page.getByRole('navigation', { name: 'Trip views' })
    await views.getByRole('button', { name: 'Places' }).click()
    const places = page.getByRole('region', { name: 'Places' })
    await expect(places).toHaveAttribute('data-snap', 'half')
    await expect(page.getByRole('region', { name: 'Itinerary' })).toBeHidden()
    await expect(places.getByRole('button', { name: /^Accommodation, 1 pin/ })).toBeVisible()
    await views.getByRole('button', { name: 'Places' }).click()
    await expect(places).toHaveAttribute('data-snap', 'closed')
    await places.getByRole('button', { name: /Places: make bigger/ }).click()
    await expect(places).toHaveAttribute('data-snap', 'half')
    await places.getByRole('button', { name: /Places: make bigger/ }).click()
    await expect(places).toHaveAttribute('data-snap', 'full')
    // The phone's back gesture steps the full sheet down, staying on the trip.
    await page.goBack()
    await expect(places).toHaveAttribute('data-snap', 'half')
    await expect(page).toHaveURL(/\/wander\/trip\/trip-saigon/)
  })

  test('⋯ holds Edit trip, Share & people and Map look', async ({ page }) => {
    await fakeSupabase(page)
    await openTrip(page)
    await page.getByRole('button', { name: 'Trip menu' }).click()
    await expect(page.getByRole('menuitem')).toHaveText(['Edit trip', 'Share & people', 'Copy pins', 'Map look & GPins'])
    await page.getByRole('menuitem', { name: 'Edit trip' }).click()
    await expect(page.getByRole('dialog', { name: 'Edit trip' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('button', { name: 'Trip menu' }).click()
    await page.getByRole('menuitem', { name: 'Share & people' }).click()
    await expect(page.getByRole('dialog', { name: /Share/ })).toBeVisible()
  })

  test('+ Add puts an activity on the day; tapping a block opens it to change times', async ({ page }) => {
    const db = await fakeSupabase(page)
    await openTrip(page)
    const itin = page.getByRole('region', { name: 'Itinerary' })
    await itin.getByRole('button', { name: '+ Add' }).click()
    const pop = itin.getByRole('dialog', { name: 'Add at 09:00' })
    await pop.getByRole('textbox', { name: 'What' }).fill('Coffee')
    await pop.getByRole('button', { name: 'Add' }).click()
    const block = itin.getByRole('button', { name: /^Coffee, 09:00 to 09:30/ })
    await expect(block).toBeVisible()
    await block.tap()
    const edit = itin.getByRole('dialog')
    await setTime(edit, 'End', '10:15')
    await edit.getByRole('button', { name: 'Save' }).click()
    await expect(itin.getByRole('button', { name: /^Coffee, 09:00 to 10:15/ })).toBeVisible()
    expect(db.acts[0]).toMatchObject({ title: 'Coffee', start_time: '09:00', end_time: '10:15' })
  })
})

test('desktop sizes never show the phone layout', async ({ page }, info) => {
  test.skip(info.project.name === 'phone', 'desktop sizes only')
  await fakeSupabase(page)
  await openTrip(page)
  await expect(page.getByRole('navigation', { name: 'Trip views' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit trip' })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Places' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open the itinerary' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Savorlog' })).toBeVisible()
})
