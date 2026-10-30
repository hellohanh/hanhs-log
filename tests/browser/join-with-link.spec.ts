import { test, expect } from '@playwright/test'
import { fakeSupabase, tripAction, FRIEND, ME } from './fake-supabase'

// Join with a link (session 15, approved mockup): an iPhone home-screen app
// keeps its own sign-in apart from Safari, so a pasted invite joins inside it.
const BUNDLE = { id: 'b1', token: 'tok-many', owner_id: ME, trip_ids: ['trip-saigon', 'trip-undated'], created_at: '2026-10-19T10:00:00Z', stopped_at: null }

test('signed out: paste a several-trips link, then Join all joins here without an email', async ({ page }) => {
  const db = await fakeSupabase(page, { signedInAs: null, bundles: [BUNDLE] })
  await page.goto('./wander')
  await page.getByRole('button', { name: 'Join with a link' }).click()
  const dlg = page.getByRole('dialog', { name: 'Join with a link' })
  await dlg.getByRole('textbox', { name: 'Invite link' }).fill('hello')
  await expect(dlg.getByRole('status')).toContainText("isn't a Hanh's Log invite link")
  await expect(dlg.getByRole('button', { name: 'Join' })).toBeDisabled()
  await dlg.getByRole('textbox', { name: 'Invite link' }).fill(' https://hellohanh.github.io/hanhs-log/wander/join-trips/tok-many ')
  await expect(dlg.getByRole('status')).toHaveText('✓ Several-trips invite')
  await dlg.getByRole('button', { name: 'Join' }).click()
  await expect(page).toHaveURL(/\/wander\/join-trips\/tok-many$/)
  await page.getByRole('button', { name: 'Join all' }).click()
  await expect(page).toHaveURL(/\/wander$/)
  expect(db.people['trip-undated']?.some(p => p.user_id === '44444444-4444-4444-4444-444444444444')).toBe(true)
})

test('signed in: Join with a link is in the trips menu and opens a trip invite', async ({ page }) => {
  await fakeSupabase(page, { signedInAs: FRIEND })
  await page.goto('./wander')
  await (await tripAction(page, 'Join with a link')).click()
  const dlg = page.getByRole('dialog', { name: 'Join with a link' })
  await dlg.getByRole('textbox', { name: 'Invite link' }).fill('https://hellohanh.github.io/hanhs-log/pr-preview/pr-9/wander/join/tok-japan')
  await expect(dlg.getByRole('status')).toHaveText('✓ Trip invite')
  await dlg.getByRole('button', { name: 'Join' }).click()
  await expect(page).toHaveURL(/\/wander\/trip\/trip-undated$/)
})

test('invite link helper', async () => {
  const { inviteKind } = await import('../../src/lib/inviteLink')
  expect(inviteKind('https://hellohanh.github.io/hanhs-log/wander/join-trips/8e295cbd-6841')).toEqual({ label: 'Several-trips invite', path: '/wander/join-trips/8e295cbd-6841' })
  expect(inviteKind('/wander/join/abc')).toEqual({ label: 'Trip invite', path: '/wander/join/abc' })
  expect(inviteKind('https://x/hanhs-log/savor/join/fam-1')?.label).toBe('Savorlog family invite')
  expect(inviteKind('https://example.com')).toBeNull()
  expect(inviteKind('')).toBeNull()
})
