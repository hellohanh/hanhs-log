import { test, expect } from '@playwright/test'
import { fakeSupabase } from './fake-supabase'

// Desktop / mobile layout toggle (session 19, Hanh): on touch devices a
// floating icon and a ☰ menu item flip the whole app between the two layouts,
// remembered on the device. For tablets and the Z Fold 8 open in landscape.

test('the toggle flips the whole app and is remembered', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'the toggle is offered on touch devices; the phone project emulates touch')
  await fakeSupabase(page)
  await page.goto('./wander')
  // Mobile layout: the ☰ (Menu) and a floating "switch to desktop".
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible()
  const toDesktop = page.getByRole('button', { name: 'Switch to desktop layout' })
  await expect(toDesktop).toBeVisible()
  // The ☰ also carries the toggle, as a "Desktop" item.
  await page.getByRole('button', { name: 'Menu' }).click()
  await expect(page.getByRole('button', { name: /Desktop/ })).toBeVisible()
  await page.keyboard.press('Escape')

  // Flip to the desktop layout: the top nav links show, the ☰ is gone.
  await toDesktop.click()
  await expect(page.getByRole('link', { name: 'Wanderlog' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Menu' })).toHaveCount(0)
  const toMobile = page.getByRole('button', { name: 'Switch to mobile layout' })
  await expect(toMobile).toBeVisible()

  // Remembered on this device: a reload stays desktop.
  await page.reload()
  await expect(page.getByRole('link', { name: 'Wanderlog' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Menu' })).toHaveCount(0)

  // Flip back to mobile.
  await page.getByRole('button', { name: 'Switch to mobile layout' }).click()
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible()
})

test('no layout toggle on a mouse (non-touch) device', async ({ page }, info) => {
  test.skip(info.project.name !== 'laptop', 'checks the floating toggle is touch-only')
  await fakeSupabase(page)
  await page.goto('./wander')
  await expect(page.getByRole('link', { name: 'Wanderlog' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Switch to (desktop|mobile) layout/ })).toHaveCount(0)
})
