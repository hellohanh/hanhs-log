import { test, expect, type Locator, type Page } from '@playwright/test'
import { fakeSupabase } from './fake-supabase'

// Offline step 2 (session 15, approved mockup screen 2): a change made with no
// signal waits on the device — the block shows "waiting to send", a yellow
// line counts what's waiting — and sends itself when the signal returns.
test.beforeEach(({}, info) => { test.skip(info.project.name === 'phone', 'desktop itinerary panel; the phone shares the same panels') })

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
  await tl.click({ position: { x: 150, y: minute }, force: true })
}

test('offline: an added activity and an edit wait on the device, then send in order when back online', async ({ page, context }) => {
  const db = await fakeSupabase(page)
  await page.goto('./wander/trip/trip-saigon')
  const panel = await openItinerary(page)
  await expect(panel.getByTestId('day-timeline')).toBeVisible()

  await context.setOffline(true)
  await clickTimeline(panel, 15 * 60)
  const pop = panel.getByRole('dialog', { name: /^Add at/ })
  await pop.getByRole('textbox', { name: 'What' }).fill('Cooking class')
  await pop.getByRole('button', { name: 'Add' }).click()

  // It shows, marked as waiting; nothing reached the database yet.
  const block = panel.getByRole('button', { name: /Cooking class/ })
  await expect(block).toBeVisible()
  // (a 30-minute block is too short for the tag to show; the dashed outline does)
  await expect(block.getByText('waiting to send')).toHaveCount(1)
  await expect(block).toHaveClass(/waiting/)
  await expect(page.getByRole('status').filter({ hasText: '1 change waiting' })).toContainText("1 change waiting · sends when you're back online")
  await expect(page.getByText('Saved on this device · sends when back online')).toBeVisible()
  expect(db.acts).toHaveLength(0)

  // Edit it while still offline: two changes wait.
  await block.click()
  const edit = panel.getByRole('dialog', { name: 'Edit activity' })
  await edit.getByRole('textbox', { name: 'Note' }).fill('Bring the voucher')
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'changes waiting' })).toContainText('2 changes waiting')
  await expect(block).toHaveAttribute('title', /Bring the voucher/)

  // Back online: both go, in order, and the yellow line leaves.
  await context.setOffline(false)
  await expect.poll(() => db.acts.length).toBe(1)
  await expect.poll(() => db.acts[0]?.note).toBe('Bring the voucher')
  expect(db.acts[0]).toMatchObject({ title: 'Cooking class' })
  await expect(page.getByRole('status').filter({ hasText: 'waiting' })).toHaveCount(0)
  await expect(block.getByText('waiting to send')).toHaveCount(0)
  // The add went first (the edit points at the id the device gave it).
  const sent = db.calls.filter(c => c.path === '/rest/v1/itinerary_activities' && c.method !== 'GET').map(c => c.method)
  expect(sent).toEqual(['POST', 'PATCH'])
  // An edit never sends a new id (only a new row gets one from the device).
  const patch = db.calls.find(c => c.path === '/rest/v1/itinerary_activities' && c.method === 'PATCH')!
  expect(JSON.parse(patch.body!).id).toBeUndefined()
})

test('a change the database refuses when it is sent is shown, then dismissed', async ({ page, context }) => {
  await fakeSupabase(page)
  await page.route('https://test-project.supabase.co/rest/v1/itinerary_activities**', route =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 403, json: { message: 'not allowed' } })
      : route.fallback()
  )
  await page.goto('./wander/trip/trip-saigon')
  const panel = await openItinerary(page)
  await expect(panel.getByTestId('day-timeline')).toBeVisible()
  await context.setOffline(true)
  await clickTimeline(panel, 15 * 60)
  const pop = panel.getByRole('dialog', { name: /^Add at/ })
  await pop.getByRole('textbox', { name: 'What' }).fill('Night market')
  await pop.getByRole('button', { name: 'Add' }).click()
  await context.setOffline(false)
  const alert = page.getByRole('alert').filter({ hasText: "Couldn't save" })
  await expect(alert).toContainText("Couldn't save an activity made offline: not allowed")
  await alert.getByRole('button', { name: 'Dismiss' }).click()
  await expect(alert).toHaveCount(0)
})

test('waiting-change helpers: laid over reads, ids, outcomes', async () => {
  const { applyOps, idsOf, withIds, sendOutcome, parseFilters, isQueueableWrite } = await import('../../src/lib/offlineQueue')
  const op = (method: 'POST' | 'PATCH' | 'DELETE', search: string, body: unknown, prefer = '') =>
    ({ seq: 1, user: 'u', method, path: '/rest/v1/itinerary_stops', search, body: JSON.stringify(body), prefer, createdAt: '', ids: [] })
  const rows = [{ id: 's1', day_id: 'd1', note: null }, { id: 's2', day_id: 'd1', note: 'x' }]
  // Insert only joins reads it belongs to.
  expect(applyOps(rows, '?select=*&day_id=in.(d1,d2)', [op('POST', '', { id: 's3', day_id: 'd2' })]).map(r => r.id)).toEqual(['s1', 's2', 's3'])
  expect(applyOps(rows, '?day_id=in.(d1)', [op('POST', '', { id: 's3', day_id: 'd2' })]).map(r => r.id)).toEqual(['s1', 's2'])
  // Edit and remove by id.
  expect(applyOps(rows, '?day_id=in.(d1)', [op('PATCH', '?id=eq.s1', { note: 'Go at 8' })])[0].note).toBe('Go at 8')
  expect(applyOps(rows, '?day_id=in.(d1)', [op('DELETE', '?id=eq.s2', null)]).map(r => r.id)).toEqual(['s1'])
  // An upsert replaces the matching review.
  const reviews = [{ pin_id: 'p', user_id: 'u', status: 'wtg' }]
  expect(applyOps(reviews, '?pin_id=in.(p)', [op('POST', '?on_conflict=pin_id,user_id', { pin_id: 'p', user_id: 'u', status: 'vis' }, 'resolution=merge-duplicates')])).toEqual([{ pin_id: 'p', user_id: 'u', status: 'vis' }])
  expect(parseFilters('?select=*&id=eq.5&order=name')).toEqual([{ col: 'id', op: 'eq', val: '5' }])
  expect(idsOf('PATCH', '?id=eq.s1', '{}')).toEqual(['s1'])
  expect(JSON.parse(withIds('itinerary_activities', '{"title":"x"}', () => 'new-id')).id).toBe('new-id')
  expect(withIds('pin_reviews', '{"pin_id":"p"}', () => 'new-id')).toBe('{"pin_id":"p"}')
  expect([sendOutcome(201), sendOutcome(401), sendOutcome(503), sendOutcome(409)]).toEqual(['done', 'retry', 'retry', 'failed'])
  expect(isQueueableWrite('POST', '/rest/v1/rpc/copy_trip_pins')).toBe(false)
  expect(isQueueableWrite('PATCH', '/rest/v1/itinerary_stops')).toBe(true)
})
