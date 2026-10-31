import { test, expect, type Locator, type Page } from '@playwright/test'
import { fakeSupabase } from './fake-supabase'

// Session 14: every itinerary time block can carry a note — a Note box in its
// popup, and a short grey line under the title on the block.
test.beforeEach(({}, info) => { test.skip(info.project.name === 'phone', 'desktop itinerary panel; the phone shares the same popups') })

const PINS = [{
  id: 'a', trip_id: 'trip-saigon', google_place_id: 'a', name: 'Bánh Xèo 46A', address: null, lat: 10.79, lng: 106.69,
  category: 'food', subcategory: 'vietnamese', subsubcategory: 'banh-xeo', michelin: null, michelin_year: null, street_food: false, fine_dining: false, note: null
}]

async function openItinerary(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Open the itinerary', exact: true }).click()
  const panel = page.getByRole('complementary', { name: 'Itinerary' })
  await panel.getByRole('tab').first().click()
  return panel
}
async function clickTimeline(panel: Locator, minute: number) {
  const tl = panel.getByTestId('day-timeline')
  await tl.scrollIntoViewIfNeeded()
  await panel.locator('[data-scroll="timeline"]').evaluate((el, y) => (el.scrollTop = y), minute - 100)
  await tl.click({ position: { x: 150, y: minute + 5 }, force: true }) // inside the slot, not on its line
}

test('an activity saves its note', async ({ page }) => {
  const db = await fakeSupabase(page)
  await page.goto('./wander/trip/trip-saigon')
  const panel = await openItinerary(page)
  await clickTimeline(panel, 15 * 60)
  const pop = panel.getByRole('dialog', { name: /^Add at/ })
  await pop.getByRole('textbox', { name: 'What' }).fill('Cooking class')
  await pop.getByRole('textbox', { name: 'Note' }).fill('Meet at the side gate')
  await pop.getByRole('button', { name: 'Add' }).click()
  await expect.poll(() => db.acts.length).toBe(1)
  expect(db.acts[0]).toMatchObject({ title: 'Cooking class', note: 'Meet at the side gate' })
  // Reopen: the note is in the box; change it.
  await panel.getByRole('button', { name: /Cooking class/ }).click()
  const edit = panel.getByRole('dialog', { name: 'Edit activity' })
  await expect(edit.getByRole('textbox', { name: 'Note' })).toHaveValue('Meet at the side gate')
  await edit.getByRole('textbox', { name: 'Note' }).fill('Bring the voucher')
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect.poll(() => db.acts[0].note).toBe('Bring the voucher')
})

test('a place on a day saves its note and shows it on the block', async ({ page }) => {
  const db = await fakeSupabase(page, { pins: PINS })
  await page.goto('./wander/trip/trip-saigon')
  const panel = await openItinerary(page)
  await clickTimeline(panel, 11 * 60)
  const pop = panel.getByRole('dialog', { name: /^Add at/ })
  await pop.getByRole('radio', { name: /Place/ }).click()
  await pop.getByRole('button', { name: /Bánh Xèo 46A/ }).first().click()
  const block = panel.getByRole('button', { name: /Bánh Xèo 46A, .* to / })
  await expect(block).toBeVisible()
  await block.click()
  const edit = panel.getByRole('dialog', { name: 'Bánh Xèo 46A' })
  await edit.getByRole('textbox', { name: 'Note' }).fill('Get the shrimp one · cash only')
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect.poll(() => (db.stops[0] as unknown as { note: string }).note).toBe('Get the shrimp one · cash only')
  // This 30-minute block is too short for the note line; its hover text has it.
  await expect(block).toHaveAttribute('title', /Get the shrimp one · cash only/)
  // A longer block shows the note under the title.
  await page.getByRole('complementary', { name: 'Places' }).getByRole('button', { name: /^Nom-Nom,/ }).click()
  await page.getByRole('complementary', { name: 'Places' }).getByRole('button', { name: /^Vietnamese,/ }).click()
  await page.getByRole('complementary', { name: 'Places' }).getByRole('button', { name: /^Bánh Xèo,/ }).click()
  await page.getByRole('complementary', { name: 'Places' }).getByRole('button', { name: /Add Bánh Xèo 46A to/ }).click()
  const long = panel.getByRole('button', { name: /Bánh Xèo 46A, 11:30 to 12:30/ })
  await expect(long).toBeVisible()
  await long.click()
  await panel.getByRole('dialog', { name: 'Bánh Xèo 46A' }).getByRole('textbox', { name: 'Note' }).fill('Second visit')
  await panel.getByRole('dialog', { name: 'Bánh Xèo 46A' }).getByRole('button', { name: 'Save' }).click()
  await expect(long.getByText('Second visit')).toBeVisible()
})
