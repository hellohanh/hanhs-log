import { test, expect, type Page, type Route } from '@playwright/test'

// Wanderlog trip list (/wander). The test build points at a stand-in
// Supabase address (https://test-project.supabase.co, set in ci.yml); every
// call to it is answered here, so these tests never touch the live database.
// Who-can-see-what is proven separately by the security tests in tests/db.

const ME = '11111111-1111-1111-1111-111111111111'
const FRIEND = '22222222-2222-2222-2222-222222222222'

const TRIPS = [
  { id: 'trip-past', name: 'Đà Nẵng & Hội An', destination: 'Đà Nẵng, Vietnam', start_date: '2025-07-03', end_date: '2025-07-10', owner_id: FRIEND, created_at: '2025-05-01T00:00:00Z', pins: [{ count: 28 }] },
  { id: 'trip-undated', name: 'Japan in spring', destination: 'Tokyo & Kyoto, Japan', start_date: null, end_date: null, owner_id: ME, created_at: '2026-09-01T00:00:00Z', pins: [{ count: 1 }] },
  { id: 'trip-rome', name: 'Rome long weekend', destination: 'Rome, Italy', start_date: '2027-03-12', end_date: '2027-03-16', owner_id: FRIEND, created_at: '2026-08-01T00:00:00Z', pins: [{ count: 17 }] },
  { id: 'trip-saigon', name: 'Christmas in Saigon', destination: 'Ho Chi Minh City, Vietnam', start_date: '2026-12-18', end_date: '2027-01-02', owner_id: ME, created_at: '2026-07-01T00:00:00Z', pins: [{ count: 42 }] }
]

function fakeJwt() {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: ME, role: 'authenticated', exp: 4102444800 })}.sig`
}

/** Pretend to be signed in, and answer the database like Supabase would. */
async function signedIn(page: Page, trips = TRIPS) {
  await page.clock.setFixedTime(new Date('2026-10-10T12:00:00'))
  const session = {
    access_token: fakeJwt(),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 4102444800,
    refresh_token: 'test-refresh',
    user: { id: ME, aud: 'authenticated', role: 'authenticated', email: 'hanh@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  }
  await page.addInitScript(s => localStorage.setItem('sb-test-project-auth-token', s), JSON.stringify(session))

  const calls: { method: string; url: string; body: string | null }[] = []
  let current = [...trips]
  await page.route('https://test-project.supabase.co/**', async (route: Route) => {
    const req = route.request()
    const url = req.url()
    calls.push({ method: req.method(), url, body: req.postData() })
    if (url.includes('/rest/v1/trips')) {
      if (req.method() === 'GET') return route.fulfill({ json: current })
      if (req.method() === 'POST') {
        const row = JSON.parse(req.postData() ?? '{}')
        current = [...current, { id: 'trip-new', created_at: '2026-10-10T12:00:00Z', pins: [{ count: 0 }], ...row }]
        return route.fulfill({ status: 201, body: '' })
      }
      if (req.method() === 'DELETE') {
        const id = new URL(url).searchParams.get('id')?.replace('eq.', '')
        current = current.filter(t => t.id !== id)
        return route.fulfill({ status: 204, body: '' })
      }
    }
    return route.fulfill({ json: {} })
  })
  return calls
}

test('signed out: asks you to sign in', async ({ page }) => {
  await page.goto('./wander')
  await expect(page.getByText('Sign in to see your trips')).toBeVisible()
  await expect(page.getByRole('main').getByRole('link', { name: 'Sign in' })).toBeVisible()
})

test('shows upcoming trips soonest first, then past trips', async ({ page }) => {
  await signedIn(page)
  await page.goto('./wander')

  const upcoming = page.locator('ul').first().getByTestId('trip-card')
  await expect(upcoming).toHaveCount(3)
  await expect(upcoming.nth(0)).toContainText('Christmas in Saigon')
  await expect(upcoming.nth(0)).toContainText('Dec 18 – Jan 2, 2027')
  await expect(upcoming.nth(0)).toContainText('42 pins')
  await expect(upcoming.nth(0)).toContainText('You own this')
  await expect(upcoming.nth(1)).toContainText('Rome long weekend')
  await expect(upcoming.nth(1)).toContainText('Mar 12 – Mar 16, 2027')
  await expect(upcoming.nth(1)).toContainText('Shared with you')
  await expect(upcoming.nth(2)).toContainText('Japan in spring')
  await expect(upcoming.nth(2)).toContainText('No dates yet')
  await expect(upcoming.nth(2)).toContainText('1 pin')

  await expect(page.getByRole('heading', { name: 'Past' })).toBeVisible()
  const past = page.locator('ul').nth(1).getByTestId('trip-card')
  await expect(past).toHaveCount(1)
  await expect(past.first()).toContainText('Jul 3 – Jul 10, 2025')

  // Only the owner gets a delete button.
  await expect(page.getByRole('button', { name: 'Delete Christmas in Saigon' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete Rome long weekend' })).toHaveCount(0)

  // A card opens its trip page.
  await page.getByRole('link', { name: 'Christmas in Saigon' }).click()
  await expect(page).toHaveURL(/\/wander\/trip\/trip-saigon$/)
})

test('creates a trip, and checks the name and destination first', async ({ page }) => {
  const calls = await signedIn(page)
  await page.goto('./wander')
  await page.getByRole('button', { name: 'New trip' }).click()

  await page.getByRole('button', { name: 'Create trip' }).click()
  await expect(page.getByRole('alert')).toHaveText('Give the trip a name and a destination.')

  await page.getByLabel('Trip name').fill('  Hà Nội in autumn ')
  await page.getByLabel('Destination').fill('Hà Nội, Vietnam')
  await page.getByLabel('Start (optional)').fill('2026-11-02')
  await page.getByLabel('End (optional)').fill('2026-11-01')
  await page.getByRole('button', { name: 'Create trip' }).click()
  await expect(page.getByRole('alert')).toHaveText('The end date is before the start date.')

  await page.getByLabel('End (optional)').fill('2026-11-09')
  await page.getByRole('button', { name: 'Create trip' }).click()

  await expect(page.getByText('Created "Hà Nội in autumn".')).toBeVisible()
  const insert = calls.find(c => c.method === 'POST' && c.url.includes('/rest/v1/trips'))
  expect(JSON.parse(insert!.body!)).toEqual({
    name: 'Hà Nội in autumn',
    destination: 'Hà Nội, Vietnam',
    start_date: '2026-11-02',
    end_date: '2026-11-09',
    owner_id: ME
  })
  // The new trip is the soonest, so it comes first.
  await expect(page.getByTestId('trip-card').first()).toContainText('Hà Nội in autumn')
  await expect(page.getByTestId('trip-card').first()).toContainText('Nov 2 – Nov 9')
})

test('deletes a trip only after you confirm', async ({ page }) => {
  const calls = await signedIn(page)
  await page.goto('./wander')

  page.once('dialog', d => d.dismiss())
  await page.getByRole('button', { name: 'Delete Japan in spring' }).click()
  expect(calls.some(c => c.method === 'DELETE')).toBe(false)

  page.once('dialog', d => {
    expect(d.message()).toContain('Delete "Japan in spring" and everything in it')
    d.accept()
  })
  await page.getByRole('button', { name: 'Delete Japan in spring' }).click()
  await expect(page.getByText('Deleted "Japan in spring".')).toBeVisible()
  await expect(page.getByTestId('trip-card').filter({ hasText: 'Japan in spring' })).toHaveCount(0)
  const del = calls.find(c => c.method === 'DELETE')
  expect(del!.url).toContain('id=eq.trip-undated')
})

test('a database error is shown, not a blank page', async ({ page }) => {
  await signedIn(page)
  await page.route('https://test-project.supabase.co/rest/v1/trips**', route =>
    route.fulfill({ status: 500, json: { message: 'something broke' } })
  )
  await page.goto('./wander')
  await expect(page.getByRole('alert')).toContainText("Couldn't load your trips")
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})
