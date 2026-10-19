import { test, expect } from '@playwright/test'
import { fakeSupabase, ME, FRIEND } from './fake-supabase'

// Session 14: one invite link for several trips (0020). Only trips you own
// can be picked; signed-in people join them all at once; links can be stopped.

test('make one link for several trips, then stop it', async ({ page }) => {
  const db = await fakeSupabase(page)
  await page.goto('./wander')
  await page.getByRole('button', { name: 'Invite to several trips' }).click()
  // Only your own trips get a tick box (Christmas in Saigon, Japan in spring).
  await expect(page.getByRole('checkbox', { name: /^Include / })).toHaveCount(2)
  await expect(page.getByRole('checkbox', { name: 'Include Rome long weekend' })).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Include Christmas in Saigon' }).check()
  await page.getByRole('checkbox', { name: 'Include Japan in spring' }).check()
  await page.getByRole('button', { name: 'Make one link · 2 trips' }).click()
  const dlg = page.getByRole('dialog', { name: 'One invite link for 2 trips' })
  await expect(dlg.getByRole('textbox', { name: 'Invite link' })).toHaveValue(/\/wander\/join-trips\/bundle-1$/)
  await expect(dlg.getByRole('listitem')).toHaveText(['Christmas in Saigon', 'Japan in spring'])
  expect(db.bundles[0]).toMatchObject({ owner_id: ME, trip_ids: ['trip-saigon', 'trip-undated'] })
  await dlg.getByRole('button', { name: 'Done' }).click()

  // Your links: Copy and Stop.
  await page.getByRole('button', { name: 'Several-trips links · 1' }).click()
  const links = page.getByRole('dialog', { name: 'Several-trips links' })
  await expect(links.getByTestId('bundle')).toContainText('Christmas in Saigon · Japan in spring')
  await links.getByRole('button', { name: 'Stop this link' }).click()
  await links.getByRole('button', { name: 'Stop', exact: true }).click()
  await expect.poll(() => db.bundles[0].stopped_at).not.toBeNull()
  await expect(links.getByTestId('bundle')).toHaveCount(0)
})

const BUNDLE = { id: 'b1', token: 'tok-many', owner_id: ME, trip_ids: ['trip-saigon', 'trip-undated'], created_at: '2026-10-19T10:00:00Z', stopped_at: null }

test('a signed-in person joins every trip on the link at once', async ({ page }) => {
  const db = await fakeSupabase(page, { signedInAs: FRIEND, bundles: [BUNDLE] })
  await page.goto('./wander/join-trips/tok-many')
  await expect(page.getByRole('heading', { name: "You're invited to 2 trips" })).toBeVisible()
  // FRIEND is already on Christmas in Saigon (sample people), so one is left.
  await expect(page.getByRole('list', { name: 'Trips on this invite' })).toContainText("Christmas in Saigon")
  await expect(page.getByText("you're already on it")).toHaveCount(1)
  await page.getByRole('button', { name: 'Join the other 1' }).click()
  await expect(page).toHaveURL(/\/wander$/)
  expect(db.people['trip-undated']?.some(p => p.user_id === FRIEND)).toBe(true)
})

test('a stopped link says so', async ({ page }) => {
  await fakeSupabase(page, { signedInAs: FRIEND, bundles: [{ ...BUNDLE, stopped_at: '2026-10-19T11:00:00Z' }] })
  await page.goto('./wander/join-trips/tok-many')
  await expect(page.getByRole('alert')).toContainText("doesn't work any more")
})

test('signed out: asked to sign in (no guest join)', async ({ page }) => {
  await fakeSupabase(page, { signedInAs: null, bundles: [BUNDLE] })
  await page.goto('./wander/join-trips/tok-many')
  await expect(page.getByRole('link', { name: 'Sign in to join' })).toBeVisible()
})
