import { test, expect } from '@playwright/test'
import { fakeSupabase } from './fake-supabase'

// Session 15 (approved mockup): Your trips' extra actions sit in a ☰ beside
// + New trip on computers; on phones they join the site's ☰ menu, which also
// links to the How-to guide.

test('computer: + New trip and a ☰ with the other actions', async ({ page }, info) => {
  test.skip(info.project.name === 'phone', 'computer layout')
  await fakeSupabase(page)
  await page.goto('./wander')
  await expect(page.getByRole('button', { name: /New trip/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Invite to several trips' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Import old pins/ })).toHaveCount(0)
  const btn = page.getByRole('button', { name: 'More trip actions' })
  await btn.click()
  const menu = page.getByRole('menu')
  await expect(menu.getByRole('menuitem')).toHaveText([/Invite to several trips/, /Import old pins/])
  // Escape closes it; picking an item does what the button used to.
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await btn.click()
  await page.getByRole('menuitem', { name: 'Invite to several trips' }).click()
  await expect(page.getByRole('button', { name: /Make one link/ })).toBeVisible()
})

test('phone: the actions and How-to are in the site ☰ on Your trips; How-to only elsewhere', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'phone layout')
  await fakeSupabase(page)
  await page.goto('./wander')
  await expect(page.getByRole('button', { name: 'More trip actions' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  const nav = page.getByRole('navigation', { name: 'Sections' })
  await expect(nav.getByRole('button', { name: 'Invite to several trips' })).toBeVisible()
  await expect(nav.getByRole('button', { name: /Import old pins/ })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'How-to' })).toHaveAttribute('href', /\/how-to\/$/)
  await nav.getByRole('button', { name: /Import old pins/ }).click()
  await expect(page.getByRole('heading', { name: 'Import old pins' })).toBeVisible()
  // Another page: the trip actions are gone from ☰, How-to stays.
  await page.goto('./roam')
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await expect(nav.getByRole('button', { name: 'Invite to several trips' })).toHaveCount(0)
  await expect(nav.getByRole('link', { name: 'How-to' })).toBeVisible()
})
