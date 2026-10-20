import { test, expect, type Locator, type Page } from '@playwright/test'
import { fakeSupabase, FRIEND } from './fake-supabase'

// Offline step 3 (session 15, approved mockup screen 3): you change something
// offline, Mai changes the same thing online; when your phone reconnects it
// asks which version stays. Changes that don't clash just go.
test.beforeEach(({}, info) => { test.skip(info.project.name === 'phone', 'desktop itinerary panel; the picker is the same on phones') })

async function openItinerary(page: Page): Promise<Locator> {
  // The panel remembers it was open, so after a reload it may already be.
  const open = page.getByRole('button', { name: 'Open the itinerary', exact: true })
  const panelTab = page.getByRole('complementary', { name: 'Itinerary' }).getByRole('tab').first()
  await expect(open.or(panelTab)).toBeVisible()
  if (await open.isVisible()) await open.click()
  const panel = page.getByRole('complementary', { name: 'Itinerary' })
  await panel.getByRole('tab').first().click()
  return panel
}

async function setup(page: Page) {
  const db = await fakeSupabase(page)
  await page.goto('./wander/trip/trip-saigon')
  const panel = await openItinerary(page)
  await expect(panel.getByTestId('day-timeline')).toBeVisible()
  // An activity that's already in the database (Meiji Jingu at 9:00).
  db.acts.push({ id: 'act-meiji', day_id: db.days[0].id, title: 'Meiji Jingu', start_time: '09:00', end_time: '10:30', note: 'Go early' })
  await page.reload()
  const p2 = await openItinerary(page)
  const block = p2.getByRole('button', { name: /Meiji Jingu/ })
  await expect(block).toBeVisible()
  return { db, panel: p2, block }
}

async function editNoteOffline(page: Page, panel: Locator, block: Locator, note: string) {
  await page.context().setOffline(true)
  await block.click()
  const edit = panel.getByRole('dialog', { name: 'Edit activity' })
  await edit.getByRole('textbox', { name: 'Note' }).fill(note)
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status').filter({ hasText: '1 change waiting' })).toBeVisible()
}

test('Mai changed the same note: you pick, and "Keep mine" sends yours', async ({ page }) => {
  const { db, panel, block } = await setup(page)
  await editNoteOffline(page, panel, block, 'Go at 8')
  // Meanwhile Mai changes it online.
  db.acts[0] = { ...db.acts[0], note: 'Go at 9', updated_by: FRIEND, updated_at: '2026-10-20T15:20:00Z' }
  await page.context().setOffline(false)

  const picker = page.getByRole('dialog', { name: /Meiji Jingu · note/ })
  await expect(picker).toContainText('Mai changed this while you were offline. Which one stays?')
  await expect(picker).toContainText('Go at 8')
  await expect(picker).toContainText('Go at 9')
  await expect(page.getByRole('status').filter({ hasText: 'pick which version stays' })).toBeVisible()
  expect(db.acts[0].note).toBe('Go at 9') // nothing sent while you decide
  await picker.getByRole('button', { name: 'Keep mine' }).click()
  await expect(picker).toHaveCount(0)
  await expect.poll(() => db.acts[0].note).toBe('Go at 8')
  await expect(page.getByRole('status').filter({ hasText: 'waiting' })).toHaveCount(0)
})

test('"Keep Mai\'s" leaves hers; a change that doesn\'t clash just goes', async ({ page }) => {
  const { db, panel, block } = await setup(page)
  await editNoteOffline(page, panel, block, 'Go at 8')
  db.acts[0] = { ...db.acts[0], note: 'Go at 9', updated_by: FRIEND }
  await page.context().setOffline(false)
  const picker = page.getByRole('dialog', { name: /Meiji Jingu/ })
  await picker.getByRole('button', { name: "Keep Mai's" }).click()
  await expect(picker).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'waiting' })).toHaveCount(0)
  expect(db.acts[0].note).toBe('Go at 9')

  // Mai changed the title only; my offline note doesn't clash with it.
  await page.reload()
  const p2 = await openItinerary(page)
  const b2 = p2.getByRole('button', { name: /Meiji Jingu/ })
  await editNoteOffline(page, p2, b2, 'Wear good shoes')
  db.acts[0] = { ...db.acts[0], title: 'Meiji Jingu shrine', updated_by: FRIEND }
  await page.context().setOffline(false)
  await expect.poll(() => db.acts[0].note).toBe('Wear good shoes')
  expect(db.acts[0].title).toBe('Meiji Jingu shrine')
  await expect(page.getByRole('dialog', { name: /Meiji Jingu/ })).toHaveCount(0)
})

test('clash helpers', async () => {
  const { clashFields, patchFields, shownValue, fieldWord } = await import('../../src/lib/offlineQueue')
  const before = { id: 'a', note: 'Go early', title: 'Meiji', start_time: '09:00:00' }
  expect(clashFields(before, { ...before, note: 'Go at 9' }, { note: 'Go at 8' })).toEqual(['note'])
  expect(clashFields(before, { ...before, note: 'Go at 8' }, { note: 'Go at 8' })).toEqual([]) // same choice
  expect(clashFields(before, { ...before, title: 'Meiji Jingu' }, { note: 'Go at 8' })).toEqual([]) // different field
  expect(clashFields(null, { ...before, note: 'x' }, { note: 'y' })).toEqual([]) // made offline, nothing to compare
  expect(clashFields(before, { ...before, updated_at: 'now' }, { updated_at: 'then' })).toEqual([])
  expect(clashFields(before, { ...before, title: 'Meiji Jingu' }, { title: 'Meiji', note: 'Go at 8' })).toEqual([]) // the form re-sent a title I didn't change
  const { changedOnly } = await import('../../src/lib/offlineQueue')
  expect(JSON.parse(changedOnly('{"title":"Meiji","note":"Go at 8"}', before))).toEqual({ note: 'Go at 8' })
  expect(JSON.parse(patchFields('{"note":"a","title":"b"}', k => k !== 'note'))).toEqual({ title: 'b' })
  expect([shownValue('09:30:00'), shownValue(null), shownValue('Go')]).toEqual(['09:30', '(empty)', 'Go'])
  expect(fieldWord('start_time')).toBe('start')
})
