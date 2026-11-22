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
    await expect(menu.getByRole('link')).toHaveText(['Wanderlog', 'Savorlog', 'Roaminglog', 'Conversion', 'How-to'])
    await expect(menu.getByRole('button', { name: /Dark mode|Light mode/ })).toBeVisible()
    await expect(menu.getByRole('button', { name: 'Sign out' })).toBeVisible()
    await menu.getByRole('link', { name: 'Savorlog' }).click()
    await expect(page).toHaveURL(/\/savor/)
  })

  test('a trip is the map: one title bar, the sheet closed with no handle, the bottom bar (session 20)', async ({ page }) => {
    await fakeSupabase(page, { pins: PINS })
    await openTrip(page)
    // The site header merges into the trip's title bar.
    await expect(page.locator('header').filter({ hasText: "Hanh's Log" })).toHaveCount(0)
    await expect(page.getByText('Dec 18 – Jan 2, 2027 · 3 people')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeVisible()
    const views = page.getByRole('navigation', { name: 'Trip views' })
    // Closed on arrival: neither tab pressed, no sheet and no handle showing.
    await expect(views.getByRole('button', { name: 'Itinerary' })).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByRole('region', { name: 'Itinerary' })).toBeHidden()
    await expect(page.getByRole('region', { name: 'Places' })).toBeHidden()
    await expect(page.getByRole('button', { name: /make bigger|make smaller/ })).toHaveCount(0)
    // Itinerary opens it, with its handle.
    await views.getByRole('button', { name: 'Itinerary' }).click()
    const itin = page.getByRole('region', { name: 'Itinerary' })
    await expect(itin).toHaveAttribute('data-snap', 'full')
    await expect(itin.getByRole('button', { name: /Itinerary: make smaller/ })).toBeVisible()
    // Before the trip starts it opens on the first day; days are one row.
    await expect(itin.getByRole('tab', { selected: true })).toContainText('Dec 18')
    const tabs = itin.getByRole('tablist', { name: 'Days' })
    expect(await tabs.evaluate(el => getComputedStyle(el).flexWrap)).toBe('nowrap')
  })

  test('during the trip it opens on today', async ({ page }) => {
    await fakeSupabase(page)
    await page.clock.setFixedTime(new Date('2026-12-25T10:00:00'))
    await openTrip(page)
    await page.getByRole('navigation', { name: 'Trip views' }).getByRole('button', { name: 'Itinerary' }).click()
    await expect(page.getByRole('region', { name: 'Itinerary' }).getByRole('tab', { selected: true })).toContainText('Dec 25')
  })

  test('the handle has a bigger invisible touch area, and a wobbly tap still counts (session 20)', async ({ page }) => {
    await fakeSupabase(page, { pins: PINS })
    await openTrip(page)
    const views = page.getByRole('navigation', { name: 'Trip views' })
    await views.getByRole('button', { name: 'Places' }).click()
    const places = page.getByRole('region', { name: 'Places' })
    await expect(places).toHaveAttribute('data-snap', 'full')
    const grab = places.getByRole('button', { name: /Places: make/ })
    await grab.click()
    await expect(places).toHaveAttribute('data-snap', 'half')
    await page.waitForTimeout(400) // the sheet settles (0.22 s)
    // 15 px above the sheet's handle, on the map: still the handle.
    const b = (await grab.boundingBox())!
    await page.mouse.click(b.x + b.width / 2, b.y - 15)
    await expect(places).toHaveAttribute('data-snap', 'full')
    // A tap whose finger wobbles 12 px (less than a swipe) still steps it.
    await grab.evaluate(el => {
      const at = (type: string, y: number) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, clientX: 200, clientY: y }))
      at('pointerdown', 500); at('pointermove', 504); at('pointermove', 509); at('pointermove', 512); at('pointerup', 512)
    })
    await expect(places).toHaveAttribute('data-snap', 'half')
  })

  test('dragging the sheet all the way down hides it, handle and all (session 20)', async ({ page }) => {
    await fakeSupabase(page, { pins: PINS })
    await openTrip(page)
    const views = page.getByRole('navigation', { name: 'Trip views' })
    await views.getByRole('button', { name: 'Itinerary' }).click()
    const itin = page.getByRole('region', { name: 'Itinerary' })
    await expect(itin).toHaveAttribute('data-snap', 'full')
    await itin.getByRole('button', { name: /Itinerary: make/ }).evaluate(el => {
      const at = (type: string, y: number) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 8, clientX: 200, clientY: y }))
      at('pointerdown', 120); at('pointermove', 300); at('pointermove', 600); at('pointerup', 800)
    })
    await expect(itin).toBeHidden()
    await expect(page.getByRole('button', { name: /make bigger|make smaller/ })).toHaveCount(0)
    await expect(views.getByRole('button', { name: 'Itinerary' })).toHaveAttribute('aria-pressed', 'false')
    // And the bar brings it back.
    await views.getByRole('button', { name: 'Itinerary' }).click()
    await expect(itin).toBeVisible()
  })

  test('the bottom bar opens and swaps sheets; tapping the open one hides it; the handle steps', async ({ page }) => {
    await fakeSupabase(page, { pins: PINS })
    await openTrip(page)
    const views = page.getByRole('navigation', { name: 'Trip views' })
    await views.getByRole('button', { name: 'Places' }).click()
    const places = page.getByRole('region', { name: 'Places' })
    await expect(places).toHaveAttribute('data-snap', 'full')
    await expect(page.getByRole('region', { name: 'Itinerary' })).toBeHidden()
    await expect(places.getByRole('button', { name: /^Accommodation, 1 pin/ })).toBeVisible()
    // The handle steps it down to half; Itinerary swaps in at the same height.
    await places.getByRole('button', { name: /Places: make smaller/ }).click()
    await expect(places).toHaveAttribute('data-snap', 'half')
    await views.getByRole('button', { name: 'Itinerary' }).click()
    await expect(page.getByRole('region', { name: 'Itinerary' })).toHaveAttribute('data-snap', 'half')
    // The open tab again closes it: no sheet, no handle.
    await views.getByRole('button', { name: 'Itinerary' }).click()
    await expect(page.getByRole('region', { name: 'Itinerary' })).toBeHidden()
    await expect(page.getByRole('button', { name: /make bigger|make smaller/ })).toHaveCount(0)
    await views.getByRole('button', { name: 'Places' }).click()
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
    await page.getByRole('navigation', { name: 'Trip views' }).getByRole('button', { name: 'Itinerary' }).click()
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
