import { test, expect, type Locator } from '@playwright/test'
import { fakeSupabase } from './fake-supabase'
import { MICHELIN_ROWS, VIBES, vibeLabels, vibesOf, michelinWords } from '../../src/lib/vibe'

// Session 14: MICHELIN chips None / Selected / Bib on line one and the stars on
// line two (no icons), and the standalone Vibe box (nine ticks, any number
// together) in Hanh's two-column layout.

test('MICHELIN rows, Vibe order and words', () => {
  expect(MICHELIN_ROWS.map(r => r.map(c => c.label))).toEqual([['None', 'Selected', 'Bib'], ['★', '★★', '★★★']])
  expect(MICHELIN_ROWS[0][1].m).toBe('mentioned') // Selected keeps the saved value
  expect(VIBES.map(v => v.label)).toEqual([
    'Dine in', 'Fine dining',
    'Street food', 'Food truck',
    'Outdoor seating', 'Community seating',
    'Food court / hawker', 'Counter / bar seating',
    'Takeaway / to-go'
  ])
  expect(vibeLabels({ takeaway: true, food_truck: true, community_seating: true })).toEqual(['Food truck', 'Community seating', 'Takeaway / to-go'])
  expect(vibesOf({ street_food: true }).dine_in).toBe(false)
  expect(michelinWords('bib')).toBe('MICHELIN Bib Gourmand')
  expect(michelinWords('mentioned')).toBe('MICHELIN Selected')
})

const PIN = {
  id: 'pin-pho', trip_id: 'trip-saigon', google_place_id: 'g-pho', name: 'Phở Hòa Pasteur', address: '260C Pasteur', lat: 10.789, lng: 106.689,
  category: 'food', subcategory: 'vietnamese', subsubcategory: 'pho', michelin: 'mentioned', michelin_year: 2025,
  street_food: true, fine_dining: false, dine_in: false, food_truck: false, outdoor_seating: false, community_seating: false,
  food_court: false, counter_seating: false, takeaway: false, note: null
}

test('the card: Selected / Bib / stars and the Vibe box save', async ({ page }, info) => {
  test.skip(info.project.name === 'phone', 'desktop Places panel; the phone uses the same card')
  const db = await fakeSupabase(page, { pins: [PIN] })
  await page.goto('./wander/trip/trip-saigon')
  const places = page.getByRole('complementary', { name: 'Places' })
  await places.getByRole('button', { name: /^Nom-Nom,/ }).click()
  await places.getByRole('button', { name: /^Vietnamese,/ }).click()
  await places.getByRole('button', { name: /^Phở,/ }).click()
  await places.getByText('Phở Hòa Pasteur').click()
  const card = places.getByRole('form', { name: 'Edit place' })

  const mich = card.getByRole('radiogroup', { name: 'MICHELIN' })
  await expect(mich.getByRole('radio', { name: 'Selected' })).toHaveAttribute('aria-checked', 'true')
  await expect(mich.getByRole('radio', { name: 'Mentioned' })).toHaveCount(0)
  // Line one and line two are separate rows.
  const rowOf = (l: Locator) => l.evaluate(el => el.parentElement!.getBoundingClientRect().top)
  const noneTop = await rowOf(mich.getByRole('radio', { name: 'None' }))
  expect(await rowOf(mich.getByRole('radio', { name: 'Bib Gourmand' }))).toBe(noneTop)
  expect(await rowOf(mich.getByRole('radio', { name: '1 star' }))).toBeGreaterThan(noneTop)
  await mich.getByRole('radio', { name: 'Bib Gourmand' }).click()

  const vibe = card.getByRole('group', { name: 'Vibe' })
  await expect(vibe.getByRole('checkbox')).toHaveCount(9)
  await expect(vibe.getByRole('checkbox', { name: 'Street food' })).toBeChecked()
  await vibe.getByRole('checkbox', { name: 'Street food' }).uncheck()
  await vibe.getByRole('checkbox', { name: 'Food truck' }).check()
  await vibe.getByRole('checkbox', { name: 'Community seating' }).check()
  // Row pairs from Hanh's layout: Dine in | Fine dining, … Food court | Counter.
  const top = (name: string) => vibe.getByRole('checkbox', { name }).evaluate(el => el.closest('label')!.getBoundingClientRect().top)
  expect(await top('Fine dining')).toBe(await top('Dine in'))
  expect(await top('Counter / bar seating')).toBe(await top('Food court / hawker'))

  await card.getByRole('button', { name: 'Save' }).click()
  await expect(places.getByRole('form')).toHaveCount(0)
  const patch = db.calls.find(c => c.method === 'PATCH' && c.path === '/rest/v1/pins')!
  expect(JSON.parse(patch.body!)).toMatchObject({ michelin: 'bib', street_food: false, food_truck: true, community_seating: true, takeaway: false })
})

test('Bib Gourmand: the face chip on the pin and in the list (session 14)', async ({ page }, info) => {
  test.skip(info.project.name === 'phone', 'desktop Places panel')
  await fakeSupabase(page, { pins: [{ ...PIN, michelin: 'bib' }] })
  await page.goto('./wander/trip/trip-saigon')
  const places = page.getByRole('complementary', { name: 'Places' })
  await places.getByRole('button', { name: /^Nom-Nom,/ }).click()
  await places.getByRole('button', { name: /^Vietnamese,/ }).click()
  await places.getByRole('button', { name: /^Phở,/ }).click()
  // The list row shows the face, not the flower.
  const mark = places.getByTitle('MICHELIN Bib Gourmand')
  await expect(mark.locator('svg circle')).toHaveCount(3)
  // The pin preview: red MICHELIN pin with the face in the chip above, no stars.
  await places.getByText('Phở Hòa Pasteur', { exact: true }).click()
  const html = await places.locator('[class*="preview"]').innerHTML()
  expect(html).toContain('fill="#9E2A2B"')
  expect(html).toContain('d="M7.5 14.2c1.2 1.9 2.8 2.8 4.5 2.8s3.3-.9 4.5-2.8"')
  expect(html).not.toContain('★')
})
