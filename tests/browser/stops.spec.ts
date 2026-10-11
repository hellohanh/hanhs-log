import { test, expect, type Locator, type Page } from '@playwright/test'
import { fakeSupabase } from './fake-supabase'
import { toMin } from '../../src/lib/itineraryDays'

// Places on itinerary days (M3 step 4): dropped/added as time blocks, OTD Pins,
// and the three ways to add one — drag, the Add popup's "Place", and the
// "Add to day" buttons. The map needs Google, so map fade is checked via
// lib/pinRules; here we check the panel behaviour and what reaches the database.

type P = Record<string, unknown>
const pin = (id: string, name: string, cat: string, sub: string | null, leaf: string | null, mich: string | null): P => ({
  id, trip_id: 'trip-saigon', google_place_id: id, name, address: 'Quận 3', lat: 10.78, lng: 106.69,
  category: cat, subcategory: sub, subsubcategory: leaf, michelin: mich, michelin_year: mich ? 2025 : null, street_food: false, fine_dining: false, note: null
})
const PINS = [pin('a', 'Phở Hòa Pasteur', 'food', 'vietnamese', 'pho', 'mentioned'), pin('b', 'Anan Saigon', 'food', 'vietnamese', null, '1')]

async function openItinerary(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Open the itinerary', exact: true }).click()
  const panel = page.getByRole('complementary', { name: 'Itinerary' })
  await panel.getByRole('tab').first().click()
  return panel
}

// y pixels down the timeline for a minute-of-day (HOUR_PX = 60).
async function clickTimeline(panel: Locator, minute: number) {
  const tl = panel.getByTestId('day-timeline')
  await tl.scrollIntoViewIfNeeded()
  const scroller = panel.locator('[data-scroll="timeline"]')
  await scroller.evaluate((el, y) => (el.scrollTop = y), (minute / 60) * 60 - 100)
  await tl.click({ position: { x: 150, y: (minute / 60) * 60 }, force: true })
}

test('"Place" in the Add popup schedules a pin at the clicked time', async ({ page }) => {
  const db = await fakeSupabase(page, { pins: PINS })
  await page.goto('./wander/trip/trip-saigon')
  const panel = await openItinerary(page)
  await clickTimeline(panel, 9 * 60)
  const pop = panel.getByRole('dialog', { name: /^Add at/ })
  await pop.getByRole('radio', { name: /Place/ }).click()
  await pop.getByRole('button', { name: /Phở Hòa Pasteur/ }).click()
  await expect(panel.getByRole('button', { name: /Phở Hòa Pasteur, .* to / })).toBeVisible()
  expect(db.stops).toHaveLength(1)
  // The block is a 60-minute stop at the clicked time.
  const st = db.stops[0] as unknown as { pin_id: string; start_time: string; end_time: string }
  expect(st.pin_id).toBe('a')
  expect(toMin(st.end_time)).toBeGreaterThan(toMin(st.start_time))
})

test('the + on a list row adds to the open day; it is off when the itinerary is closed', async ({ page }) => {
  const db = await fakeSupabase(page, { pins: PINS })
  await page.goto('./wander/trip/trip-saigon')
  const places = page.getByRole('complementary', { name: 'Places' })
  // Closed: the + is disabled.
  await expect(places.getByRole('button', { name: /Add to a day/ }).first()).toBeDisabled()
  await openItinerary(page)
  // Open: the + names the day and adds a stop.
  const add = places.getByRole('button', { name: /Add Phở Hòa Pasteur to/ })
  await expect(add).toBeEnabled()
  await add.click()
  const panel = page.getByRole('complementary', { name: 'Itinerary' })
  await expect(panel.getByRole('button', { name: /Phở Hòa Pasteur, 0?9:00 to 10:00/ })).toBeVisible()
  expect(db.stops).toHaveLength(1)
  expect(db.stops[0]).toMatchObject({ pin_id: 'a', start_time: '09:00', end_time: '10:00' })
  // A second place added to the day tab stacks after the first (ends at 10:00 → starts 10:00).
  await places.getByRole('button', { name: /Add Anan Saigon to/ }).click()
  await expect(panel.getByRole('button', { name: /Anan Saigon, 10:00 to 11:00/ })).toBeVisible()
})

test('the pin card has an "Add to day" button for the open day', async ({ page }) => {
  const db = await fakeSupabase(page, { pins: PINS })
  await page.goto('./wander/trip/trip-saigon')
  const places = page.getByRole('complementary', { name: 'Places' })
  await places.getByRole('button', { name: /Phở Hòa Pasteur/ }).first().click()
  const card = places.getByRole('form', { name: 'Edit place' })
  // Itinerary closed: the button is disabled.
  await expect(card.getByRole('button', { name: /open the itinerary first/ })).toBeDisabled()
  await card.getByRole('button', { name: 'Close' }).click()
  const panel = await openItinerary(page)
  await places.getByRole('button', { name: /Phở Hòa Pasteur/ }).first().click()
  await places.getByRole('form', { name: 'Edit place' }).getByRole('button', { name: /^\+ Add to/ }).click()
  await expect(panel.getByRole('button', { name: /Phở Hòa Pasteur, .* to / })).toBeVisible()
  expect(db.stops).toHaveLength(1)
  expect(db.stops[0]).toMatchObject({ pin_id: 'a' })
})

test('a dragged pin lands on the timeline where it is dropped', async ({ page }) => {
  const db = await fakeSupabase(page, { pins: PINS })
  await page.goto('./wander/trip/trip-saigon')
  const panel = await openItinerary(page)
  const places = page.getByRole('complementary', { name: 'Places' })
  const row = places.getByRole('button', { name: /Anan Saigon/ }).first()
  const tl = panel.getByTestId('day-timeline')
  await panel.locator('[data-scroll="timeline"]').evaluate(el => (el.scrollTop = 0))
  // Native HTML5 drag-and-drop with a shared DataTransfer. Drop 14 hours
  // (14 × HOUR_PX) below the timeline's top, which is 14:00 on the grid.
  const y = (await tl.boundingBox())!.y + 14 * 60
  const dt = await page.evaluateHandle(() => new DataTransfer())
  await row.dispatchEvent('dragstart', { dataTransfer: dt })
  await tl.dispatchEvent('dragover', { dataTransfer: dt, clientX: 150, clientY: y })
  await tl.dispatchEvent('drop', { dataTransfer: dt, clientX: 150, clientY: y })
  // The drag scheduled Anan onto the day (a 60-minute stop at the drop time).
  await expect(panel.getByRole('button', { name: /Anan Saigon, .* to / })).toBeVisible()
  const st = db.stops[0] as unknown as { pin_id: string; start_time: string; end_time: string }
  expect(st.pin_id).toBe('b')
  expect(toMin(st.end_time) - toMin(st.start_time)).toBe(60)
})

test('a scheduled place can be retimed and taken off the day', async ({ page }) => {
  const db = await fakeSupabase(page, { pins: PINS })
  await page.goto('./wander/trip/trip-saigon')
  const panel = await openItinerary(page)
  // Add one via the list +, then open it.
  await page.getByRole('complementary', { name: 'Places' }).getByRole('button', { name: /Add Phở Hòa Pasteur to/ }).click()
  const block = panel.getByRole('button', { name: /Phở Hòa Pasteur, 0?9:00 to 10:00/ })
  await block.click()
  const edit = panel.getByRole('dialog', { name: 'Phở Hòa Pasteur' })
  await edit.getByLabel('End').fill('10:30')
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(panel.getByRole('button', { name: /Phở Hòa Pasteur, 0?9:00 to 10:30/ })).toBeVisible()
  expect(db.stops[0]).toMatchObject({ start_time: '09:00', end_time: '10:30' })
  // Remove it.
  await panel.getByRole('button', { name: /Phở Hòa Pasteur, 0?9:00 to 10:30/ }).click()
  await panel.getByRole('dialog', { name: 'Phở Hòa Pasteur' }).getByRole('button', { name: 'Remove' }).click()
  await panel.getByRole('alert').getByRole('button', { name: 'Remove' }).click()
  await expect(panel.getByRole('button', { name: /Phở Hòa Pasteur,/ })).toHaveCount(0)
  expect(db.stops).toHaveLength(0)
})

test('OTD Pins: off by default, and the map fade rule it drives', async ({ page }) => {
  await fakeSupabase(page, { pins: PINS })
  await page.goto('./wander/trip/trip-saigon')
  const panel = await openItinerary(page)
  await expect(panel.getByLabel('OTD Pins')).not.toBeChecked()
  await panel.getByLabel('OTD Pins').check()
  await expect(panel.getByLabel('OTD Pins')).toBeChecked()

  const { pinFaded } = await import('../../src/lib/pinRules')
  const day = new Set(['a'])
  // OTD on: the day's pin is bright, others fade — overriding Show all / MICHELIN.
  expect(pinFaded({ id: 'a', michelin: null }, { editing: false, otdPins: day, showAll: false, michelinOnly: true })).toBe(false)
  expect(pinFaded({ id: 'b', michelin: '1' }, { editing: false, otdPins: day, showAll: true, michelinOnly: false })).toBe(true)
  // OTD off: Show all off fades everything; MICHELIN filter fades non-MICHELIN.
  expect(pinFaded({ id: 'a', michelin: null }, { editing: false, otdPins: null, showAll: false, michelinOnly: false })).toBe(true)
  expect(pinFaded({ id: 'a', michelin: null }, { editing: false, otdPins: null, showAll: true, michelinOnly: true })).toBe(true)
  expect(pinFaded({ id: 'b', michelin: '1' }, { editing: false, otdPins: null, showAll: true, michelinOnly: true })).toBe(false)
  // The pin being edited is never faded.
  expect(pinFaded({ id: 'a', michelin: null }, { editing: true, otdPins: day, showAll: false, michelinOnly: false })).toBe(false)
})

test('stop helpers: default start stacks after the last stop', async () => {
  const { nextStopStart, STOP_MIN } = await import('../../src/lib/itineraryDays')
  const s = (start: string, end: string) => ({ id: 'x', day_id: 'd', pin_id: 'p', start_time: start, end_time: end, note: null })
  expect(STOP_MIN).toBe(60)
  expect(nextStopStart([])).toBe(9 * 60)
  expect(nextStopStart([s('09:00', '10:00')])).toBe(10 * 60)
  expect(nextStopStart([s('09:00', '10:00'), s('11:30', '13:00')])).toBe(13 * 60)
})

