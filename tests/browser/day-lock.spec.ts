import { test, expect, type Locator, type Page } from '@playwright/test'
import { fakeSupabase } from './fake-supabase'

// Day lock (session 16, migration 0025, approved mockup): a lock per day,
// shared by everyone on the trip. A locked day's blocks can't be moved or
// resized; a tap still opens them; days start locked in the database.

async function clickTimeline(panel: Locator, minute: number) {
  const tl = panel.getByTestId('day-timeline')
  await tl.scrollIntoViewIfNeeded()
  const box = (await tl.boundingBox())!
  await panel.page().mouse.click(box.x + box.width / 2, box.y + minute)
}
async function drag(page: Page, block: Locator, dy: number) {
  const b = (await block.boundingBox())!
  const x = b.x + b.width / 2
  const y = b.y + b.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + dy / 2)
  await page.mouse.move(x, y + dy)
  await page.mouse.up()
}

test('day lock: a locked day keeps its blocks in place, a tap still opens them, unlock to move', async ({ page }, info) => {
  test.skip(info.project.name === 'phone', 'upright phones never drag blocks; this is the computer layout (phone sideways, tablets)')
  const db = await fakeSupabase(page)
  await page.goto('./wander/trip/trip-saigon')
  await page.getByRole('button', { name: 'Open the itinerary' }).click()
  const panel = page.getByRole('complementary', { name: 'Itinerary' })
  await clickTimeline(panel, 10 * 60 + 5)
  await panel.getByRole('dialog', { name: 'Add at 10:00' }).getByRole('textbox', { name: 'What' }).fill('Coffee')
  await panel.getByRole('dialog', { name: 'Add at 10:00' }).getByRole('button', { name: 'Add' }).click()
  await expect(panel.getByRole('button', { name: /Coffee, 10:00 to 10:30/ })).toBeVisible()
  const dayId = db.acts[0].day_id

  // Lock it: saved for everyone, the tab shows a padlock.
  await panel.getByRole('button', { name: /lock to stop moves/ }).click()
  await expect.poll(() => db.days.find(d => d.id === dayId)?.locked).toBe(true)
  const lock = panel.getByRole('button', { name: /Day locked: unlock/ })
  await expect(lock).toHaveAttribute('aria-pressed', 'true')
  await expect(panel.getByRole('tab', { selected: true }).getByLabel('locked')).toBeVisible()

  // A drag does nothing but say why; the block keeps its time.
  const block = panel.getByRole('button', { name: /Coffee, 10:00 to 10:30\. Day locked/ })
  await drag(page, block, 60)
  await expect(panel.getByRole('status').filter({ hasText: 'Day locked. Tap the lock to move things.' })).toBeVisible()
  await expect(panel.getByRole('button', { name: /Coffee, 10:00 to 10:30/ })).toBeVisible()
  expect(db.acts[0]).toMatchObject({ start_time: '10:00', end_time: '10:30' })
  await expect(panel.getByRole('dialog')).toHaveCount(0)

  // A tap still opens it.
  await block.click()
  await expect(panel.getByRole('dialog', { name: 'Edit activity' })).toBeVisible()
  await panel.getByRole('dialog', { name: 'Edit activity' }).getByRole('button', { name: 'Cancel', exact: true }).click()

  // Unlock: the padlock goes, and dragging works again.
  await lock.click()
  await expect.poll(() => db.days.find(d => d.id === dayId)?.locked).toBe(false)
  await expect(panel.getByRole('tab', { selected: true }).getByLabel('locked')).toHaveCount(0)
  await drag(page, panel.getByRole('button', { name: /Coffee/ }), 60)
  await expect(panel.getByRole('button', { name: /Coffee, 11:00 to 11:30/ })).toBeVisible()
  await expect.poll(() => db.acts[0]).toMatchObject({ start_time: '11:00', end_time: '11:30' })
})

test('day lock: a day saved as locked opens locked, and the phone has the lock too', async ({ page }) => {
  const db = await fakeSupabase(page)
  const phone = (page.viewportSize()?.width ?? 1000) <= 760
  // The phone opens on the Itinerary sheet; larger screens open the panel.
  const open = async () => {
    if (phone) return
    const opener = page.getByRole('button', { name: 'Open the itinerary' })
    const panel = page.getByRole('complementary', { name: 'Itinerary' })
    await expect(opener.or(panel).first()).toBeVisible()
    if (await opener.isVisible()) await opener.click()
  }
  await page.goto('./wander/trip/trip-saigon')
  await open()
  await expect.poll(() => db.days.length).toBeGreaterThan(0)
  // Days saved by the database are locked (migration 0025's default).
  for (const d of db.days) d.locked = true
  await page.reload()
  await page.waitForLoadState('networkidle')
  await open()
  const panel = phone ? page.getByRole('region', { name: 'Itinerary' }) : page.getByRole('complementary', { name: 'Itinerary' })
  await expect(panel.getByRole('button', { name: /Day locked: unlock/ })).toBeVisible()
  await expect(panel.getByRole('tab', { selected: true }).getByLabel('locked')).toBeVisible()
})

test('itinerary: 100 px of room under 11:59 pm so the day can be scrolled past its end', async ({ page }) => {
  await fakeSupabase(page)
  await page.goto('./wander/trip/trip-saigon')
  const phone = (page.viewportSize()?.width ?? 1000) <= 760
  if (!phone) await page.getByRole('button', { name: 'Open the itinerary' }).click()
  const tl = page.getByTestId('day-timeline')
  await expect(tl).toBeVisible()
  const room = await tl.evaluate(el => {
    const sc = el.closest('[data-scroll="timeline"]') as HTMLElement
    sc.scrollTop = sc.scrollHeight
    return Math.round(sc.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom)
  })
  expect(room).toBeGreaterThanOrEqual(100)
})
