import { test, expect, type Page } from '@playwright/test'
import { fakeSupabase } from './fake-supabase'
import { googleSuggestion, joinName, plainName } from '../../src/lib/placeName'

// Session 14: Google's spelling is suggested under a name box when the same
// name differs in accents or capitals; "Use it" keeps Google's exact text on
// save. BBQ is always written in capitals.

test('name rules: BBQ, Google suggestion, exact spelling kept', () => {
  expect(joinName('korean bbq house', '')).toBe('Korean BBQ House')
  expect(joinName('', 'MÀU')).toBe('Màu') // typed capitals still tidied…
  expect(joinName('', 'MÀU', { local: true })).toBe('MÀU') // …unless it's Google's spelling
  expect(plainName('Bánh Xèo 46A')).toBe('banh xeo 46a')
  expect(plainName('Đông Phố')).toBe('dong pho')
  expect(googleSuggestion({ en: '', local: 'banh xeo 46a' }, 'Bánh Xèo 46A')).toEqual({ side: 'local', text: 'Bánh Xèo 46A' })
  expect(googleSuggestion({ en: 'Mau', local: '' }, 'MÀU')).toEqual({ side: 'en', text: 'MÀU' })
  // Same spelling once tidied, or already accepted → nothing to suggest.
  expect(googleSuggestion({ en: '', local: 'phở hòa pasteur' }, 'Phở Hòa Pasteur')).toBeNull()
  expect(googleSuggestion({ en: '', local: 'MÀU', exact: { local: true } }, 'MÀU')).toBeNull()
  // A different name altogether isn't a spelling fix.
  expect(googleSuggestion({ en: 'Lunch Lady', local: '' }, 'Bún Chả Hương Liên')).toBeNull()
  expect(googleSuggestion({ en: 'x', local: '' }, null)).toBeNull()
})

async function fakeGoogle(page: Page) {
  await page.route('https://places.googleapis.com/**', route => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ json: { places: [{ id: 'gp-bx', displayName: { text: 'Bánh Xèo 46A' }, formattedAddress: '46A Đinh Công Tráng, Hồ Chí Minh', location: { latitude: 10.79, longitude: 106.69 } }] } })
    }
    return route.fulfill({ json: { photos: [] } })
  })
}

test('the add card offers Google\'s spelling and saves it exactly', async ({ page }, info) => {
  test.skip(info.project.name === 'phone', 'computer Munch List; the phone uses the same card')
  const db = await fakeSupabase(page, { eateries: [] })
  await fakeGoogle(page)
  await page.goto('./savor')
  const side = page.getByRole('complementary', { name: 'Catalogue' })
  await side.getByRole('searchbox', { name: /Search Google/ }).fill('banh xeo')
  await side.getByRole('button', { name: 'Search' }).click()
  await side.getByRole('button', { name: /Bánh Xèo 46A/ }).first().click()
  const form = side.getByRole('form', { name: 'Add an eatery' })

  await form.getByLabel('Local title').fill('banh xeo 46a')
  await expect(form.getByText('Saves as: Banh Xeo 46a')).toBeVisible()
  await form.getByRole('button', { name: "Use Google's spelling: Bánh Xèo 46A" }).click()
  await expect(form.getByLabel('Local title')).toHaveValue('Bánh Xèo 46A')
  await expect(form.getByText('Saves as: Bánh Xèo 46A')).toBeVisible()
  await expect(form.getByText('Google spells it')).toHaveCount(0)

  await form.getByLabel('Cuisine (country)').selectOption({ label: 'Vietnamese' })
  await form.getByRole('button', { name: 'Add eatery' }).click()
  await expect.poll(() => db.eateries.length).toBe(1)
  expect(db.eateries[0].name).toBe('Bánh Xèo 46A')
})
