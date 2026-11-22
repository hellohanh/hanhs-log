import { test, expect } from '@playwright/test'
import { fakeSupabase } from './fake-supabase'

// Desktop / mobile layout toggle (session 19, Hanh; moved in session 20): on
// touch devices the ☰ menu item and a round button at the end of each map's
// button set flip the whole app between the two layouts, remembered on the
// device. The floating pill is gone. The map button needs a loaded map, which
// test builds don't have (no Maps key), so it was checked on screenshots with
// a stand-in map; here: the ☰ item, remembering, and no floating pill.

test('the ☰ item flips the whole app and it is remembered; no floating pill', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'the toggle is offered on touch devices; the phone project emulates touch')
  await fakeSupabase(page)
  await page.goto('./wander')
  // Mobile layout: the ☰ (Menu); no floating "switch to desktop" any more.
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Switch to desktop layout' })).toHaveCount(0)

  // The ☰ carries the toggle, as a "Desktop" item.
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('button', { name: /Desktop/ }).click()

  // Desktop layout: the top nav links show, the ☰ is gone, no floating pill.
  await expect(page.getByRole('link', { name: 'Wanderlog' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Menu' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Switch to mobile layout' })).toHaveCount(0)

  // Remembered on this device: a reload stays desktop.
  await page.reload()
  await expect(page.getByRole('link', { name: 'Wanderlog' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Menu' })).toHaveCount(0)
})

test('no layout toggle on a mouse (non-touch) device', async ({ page }, info) => {
  test.skip(info.project.name !== 'laptop', 'checks the toggle is touch-only')
  await fakeSupabase(page)
  await page.goto('./wander')
  await expect(page.getByRole('link', { name: 'Wanderlog' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Switch to (desktop|mobile) layout/ })).toHaveCount(0)
})
