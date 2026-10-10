import { test, expect } from '@playwright/test'
import { fakeSupabase, FRIEND } from './fake-supabase'

// The trip page, Share & people, the first-name prompt and invite links,
// against the stand-in Supabase in fake-supabase.ts.

test('trip page shows the trip, its dates and the people on it', async ({ page }) => {
  await fakeSupabase(page)
  await page.goto('./wander/trip/trip-saigon')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Christmas in Saigon')
  await expect(page.getByText('Hồ Chí Minh City · Vietnam · Dec 18 – Jan 2, 2027')).toBeVisible()
  await expect(page.getByRole('button', { name: '3 people on this trip' })).toBeVisible()
  // The itinerary is a panel on the map now; no Map / Itinerary tabs.
  await expect(page.getByRole('tab', { name: 'Map' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Open the itinerary' })).toBeVisible()
})

test('a trip you are not on says so instead of breaking', async ({ page }) => {
  await fakeSupabase(page)
  await page.goto('./wander/trip/not-mine')
  await expect(page.getByText("Can't open this trip")).toBeVisible()
})

test('edit trip saves name, Country, cities and dates with the same form as New trip', async ({ page }) => {
  const db = await fakeSupabase(page)
  await page.goto('./wander/trip/trip-saigon')
  await expect(page.getByText('Hồ Chí Minh City · Vietnam · Dec 18 – Jan 2, 2027')).toBeVisible()
  await page.getByRole('button', { name: 'Edit trip' }).click()
  const form = page.getByRole('form', { name: 'Edit trip' })
  await expect(form.getByLabel('Country')).toHaveValue('Vietnam')
  await expect(form.getByLabel('Primary City')).toHaveValue('Hồ Chí Minh City')
  await form.getByLabel('Trip name').fill('Tết in Saigon')
  await form.getByLabel('Primary City').fill('')
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form.getByRole('alert')).toHaveText('Add a Country and a Primary City.')
  await form.getByLabel('Primary City').fill('Hồ Chí Minh City')
  await form.getByLabel('Tertiary City').fill('Vũng Tàu')
  await form.getByLabel('End').fill('2026-12-01')
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form.getByRole('alert')).toHaveText('The end date is before the start date.')
  await form.getByLabel('End').fill('2027-02-20')
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tết in Saigon')
  await expect(page.getByText('Hồ Chí Minh City, Vũng Tàu · Vietnam', { exact: false })).toBeVisible()
  const patch = db.calls.find(c => c.method === 'PATCH')
  expect(JSON.parse(patch!.body!)).toEqual({
    name: 'Tết in Saigon', country: 'Vietnam', city_primary: 'Hồ Chí Minh City', city_secondary: null, city_tertiary: 'Vũng Tàu',
    start_date: '2026-12-18', end_date: '2027-02-20'
  })
  expect(patch!.url).toContain('id=eq.trip-saigon')
})

test('owner: share & people shows the link, names, remove and reset', async ({ page }) => {
  const db = await fakeSupabase(page)
  await page.goto('./wander/trip/trip-saigon')
  await page.getByRole('button', { name: 'Share & people' }).click()
  const dialog = page.getByRole('dialog', { name: 'Share & people' })
  await expect(dialog).toBeVisible()

  await expect(dialog.getByLabel('Invite link')).toHaveValue(/\/wander\/join\/tok-saigon$/)
  const people = dialog.getByTestId('person')
  await expect(people).toHaveCount(3)
  await expect(people.nth(0)).toContainText('Hanh (you)')
  await expect(people.nth(0)).toContainText('Owner')
  await expect(people.nth(1)).toContainText('Mai')
  await expect(people.nth(1)).toContainText('Joined Oct 2')
  await expect(people.nth(2)).toContainText('No name yet')
  await expect(people.nth(0).getByRole('button', { name: 'Remove' })).toHaveCount(0)

  // Remove asks first.
  page.once('dialog', d => d.accept())
  await people.nth(1).getByRole('button', { name: 'Remove' }).click()
  await expect(dialog.getByText('Removed Mai.')).toBeVisible()
  await expect(people).toHaveCount(2)
  const removal = db.calls.find(c => c.path.endsWith('/rpc/remove_trip_member'))
  expect(JSON.parse(removal!.body!)).toEqual({ _trip: 'trip-saigon', _user: FRIEND })

  // Reset makes a new link.
  page.once('dialog', d => d.accept())
  await dialog.getByRole('button', { name: /Reset link/ }).click()
  await expect(dialog.getByLabel('Invite link')).toHaveValue(/\/wander\/join\/tok-reset$/)
  await expect(dialog.getByText('New invite link made.')).toBeVisible()

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
})

test('member: no remove or reset buttons, but can change their own name', async ({ page }) => {
  const db = await fakeSupabase(page)
  await page.goto('./wander/trip/trip-rome')
  await page.getByRole('button', { name: 'Share & people' }).click()
  const dialog = page.getByRole('dialog', { name: 'Share & people' })
  await expect(dialog.getByTestId('person')).toHaveCount(2)
  await expect(dialog.getByRole('button', { name: 'Remove' })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: /Reset link/ })).toHaveCount(0)

  await dialog.getByRole('button', { name: 'change your name' }).click()
  await dialog.getByLabel('Your first name').fill('Hạnh')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByTestId('person').filter({ hasText: '(you)' })).toContainText('Hạnh (you)')
  expect(db.myName).toBe('Hạnh')
})

test('someone without a first name is asked for one', async ({ page }) => {
  const db = await fakeSupabase(page, { myName: null })
  await page.goto('./wander/trip/trip-saigon')
  const prompt = page.getByRole('dialog', { name: 'What should people call you?' })
  await expect(prompt).toBeVisible()
  await prompt.getByRole('button', { name: 'Save' }).click()
  await expect(prompt.getByRole('alert')).toHaveText('Type a first name.')
  await prompt.getByLabel('First name').fill('Hanh')
  await prompt.getByRole('button', { name: 'Save' }).click()
  await expect(prompt).toBeHidden()
  expect(db.myName).toBe('Hanh')
})

test('"Later" closes the name question for now', async ({ page }) => {
  await fakeSupabase(page, { myName: null })
  await page.goto('./wander/trip/trip-saigon')
  await page.getByRole('button', { name: 'Later' }).click()
  await expect(page.getByRole('dialog', { name: 'What should people call you?' })).toBeHidden()
})

test('invite link: a visitor joins without an email, then is asked for a first name', async ({ page }) => {
  const db = await fakeSupabase(page, { signedInAs: null })
  await page.goto('./wander/join/tok-saigon')
  await expect(page.getByRole('heading', { name: "You've been invited to a trip" })).toBeVisible()
  await page.getByRole('button', { name: 'Join trip' }).click()

  await expect(page).toHaveURL(/\/wander\/trip\/trip-saigon$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Christmas in Saigon')
  expect(db.calls.some(c => c.path === '/auth/v1/signup')).toBe(true)
  const join = db.calls.find(c => c.path.endsWith('/rpc/join_trip_via_invite'))
  expect(JSON.parse(join!.body!)).toEqual({ _token: 'tok-saigon' })
  await expect(page.getByRole('dialog', { name: 'What should people call you?' })).toBeVisible()
})

test('invite link: someone already signed in joins straight away', async ({ page }) => {
  await fakeSupabase(page)
  await page.goto('./wander/join/tok-rome')
  await expect(page).toHaveURL(/\/wander\/trip\/trip-rome$/)
})

test('invite link: an old or wrong link explains what to do', async ({ page }) => {
  await fakeSupabase(page)
  await page.goto('./wander/join/tok-nope')
  await expect(page.getByRole('alert')).toContainText("This invite link doesn't work")
})

test('the map area opens empty: no old pins, and says why there is no map in a build without a key', async ({ page }) => {
  await fakeSupabase(page)
  await page.goto('./wander/trip/trip-saigon')
  await expect(page.getByText('No places on this trip yet.')).toBeVisible()
  await expect(page.getByText('Old Wanderlog pins show here and on the map once you sort them.', { exact: false })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: "The map can't load in this build" })).toBeVisible()
})

test('the map looks up the Primary City in its Country; Districts within 20 km of HCMC', async () => {
  const { mapQuery, placeLabel } = await import('../../src/lib/place')
  expect(mapQuery({ country: ' Vietnam ', city_primary: 'Hồ Chí Minh City ' })).toBe('Hồ Chí Minh City, Vietnam')
  expect(placeLabel({ country: 'Vietnam', city_primary: 'Hồ Chí Minh City', city_secondary: null, city_tertiary: 'Vũng Tàu' }))
    .toBe('Hồ Chí Minh City, Vũng Tàu · Vietnam')
  const { distanceKm, HCMC_CENTRE, countryNames } = await import('../../src/lib/cityName')
  expect(countryNames()).toContain('Vietnam')
  expect(countryNames()).toContain('Italy')
  // The Districts button shows within 20 km of Ho Chi Minh City.
  expect(distanceKm(HCMC_CENTRE, { lat: 10.8188, lng: 106.6519 })).toBeLessThan(20)
  expect(distanceKm(HCMC_CENTRE, { lat: 15.8801, lng: 108.338 })).toBeGreaterThan(20)
})

test('pins toggle: hides only Google\'s place pins, and which map each look needs', async () => {
  const { MAP_LOOKS, lookOptions, canHidePins } = await import('../../src/lib/mapStyles')
  const by = (k: string) => MAP_LOOKS.find(l => l.key === k)!
  expect(MAP_LOOKS).toHaveLength(11) // one Satellite look (photos with names)
  expect(by('satellite').mapTypeId).toBe('hybrid')
  // Pins shown: Google's own looks stay on the tilt map, untouched.
  expect(lookOptions(by('standard'), true)).toMatchObject({ styles: null, tiltable: true })
  expect(lookOptions(by('satellite'), true)).toMatchObject({ mapTypeId: 'hybrid', styles: null, tiltable: true })
  // No pins: only place labels go; transit pins and; street names are not touched.
  const off = JSON.stringify(lookOptions(by('standard'), false).styles)
  expect(off).toContain('"featureType":"poi","elementType":"labels","stylers":[{"visibility":"off"}]')
  expect(off).not.toContain('transit') // transit pins stay (Hanh, session 4)
  expect(off).toContain('"featureType":"poi.park","elementType":"labels.text","stylers":[{"visibility":"on"}]') // park names stay
  expect(off).not.toContain('"featureType":"road"')
  expect(lookOptions(by('standard'), false).tiltable).toBe(false)
  expect(lookOptions(by('satellite'), false)).toMatchObject({ mapTypeId: 'hybrid', tiltable: false })
  // Hand-made Night keeps its own colours and labels, minus the pins.
  const night = JSON.stringify(lookOptions(by('night'), false).styles)
  expect(night).toContain('#242f3e')
  expect(night).toContain('"featureType":"poi","elementType":"labels"')
  // Google dark's pins can't be hidden (yet).
  expect(canHidePins(by('google-dark'))).toBe(false)
  expect(lookOptions(by('google-dark'), false)).toMatchObject({ styles: null, tiltable: true })
})

test('Districts chip: shows only while an HCMC district is in view', async () => {
  const { anyDistrictInView, DISTRICT_BOXES } = await import('../../src/lib/districts')
  expect(DISTRICT_BOXES).toHaveLength(22)
  // Central HCMC at zoom 13.
  expect(anyDistrictInView({ south: 10.74, north: 10.81, west: 106.65, east: 106.75 })).toBe(true)
  // Panned out to sea off Vũng Tàu, and over Hà Nội: no district in view.
  expect(anyDistrictInView({ south: 10.2, north: 10.3, west: 107.3, east: 107.4 })).toBe(false)
  expect(anyDistrictInView({ south: 20.98, north: 21.06, west: 105.78, east: 105.9 })).toBe(false)
})

test('itinerary panel: closed by default, opens with a tab per trip date, widens, and remembers', async ({ page }) => {
  const db = await fakeSupabase(page)
  await page.goto('./wander/trip/trip-saigon')
  await expect(page.getByRole('complementary', { name: 'Itinerary' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Open the itinerary' }).click()
  const panel = page.getByRole('complementary', { name: 'Itinerary' })
  await expect(panel).toBeVisible()
  // Christmas in Saigon runs Dec 18 – Jan 2: one tab per date (16), first selected.
  await expect(panel.getByRole('tab')).toHaveCount(16)
  await expect(panel.getByRole('tab').first()).toHaveAttribute('aria-selected', 'true')
  await expect(panel.getByRole('tab').first()).toContainText('Dec 18')
  expect(db.days).toHaveLength(16)
  expect((await panel.boundingBox())!.width).toBeLessThanOrEqual(321)
  await panel.getByRole('button', { name: 'Widen to 200%' }).click()
  await expect(panel.getByRole('button', { name: 'Back to normal width' })).toHaveAttribute('aria-pressed', 'true')
  // Reload: still open and wide on this device (the panel may be capped to a narrow screen).
  await page.reload()
  await expect(page.getByRole('complementary', { name: 'Itinerary' }).getByRole('button', { name: 'Back to normal width' })).toBeVisible()
  await page.getByRole('button', { name: 'Close the itinerary' }).click()
  await expect(page.getByRole('button', { name: 'Open the itinerary' })).toBeVisible()
})

test('itinerary panel: extra days, day notes and a flight with its duration across time zones', async ({ page }) => {
  const db = await fakeSupabase(page)
  await page.goto('./wander/trip/trip-saigon')
  await page.getByRole('button', { name: 'Open the itinerary' }).click()
  const panel = page.getByRole('complementary', { name: 'Itinerary' })
  await panel.getByRole('button', { name: '+ Day' }).click()
  await expect(panel.getByRole('tab')).toHaveCount(17)
  await expect(panel.getByRole('tab').last()).toContainText('Day 17')

  // Day note.
  await panel.getByRole('button', { name: 'Day note' }).click()
  await panel.getByRole('textbox', { name: 'Day note' }).fill('Land at SGN, Grab to the hotel')
  await panel.getByRole('button', { name: /Add travel/ }).focus()
  await expect.poll(() => db.days[0].note).toBe('Land at SGN, Grab to the hotel')

  // A flight Tokyo → Saigon: picking the airports fills their time zones.
  await panel.getByRole('button', { name: /Add travel/ }).click()
  const form = panel.getByRole('form', { name: 'Add travel' })
  await form.getByLabel('Airline').fill('Vietnam Airlines')
  await form.getByLabel('Flight number').fill('VN 300')
  await form.getByRole('group', { name: 'From' }).getByLabel('Airport').fill('Tokyo / NRT')
  await form.getByRole('group', { name: 'From' }).getByLabel('Time', { exact: true }).fill('09:30')
  await form.getByRole('group', { name: 'To' }).getByLabel('Airport').fill('Ho Chi Minh City / SGN')
  await form.getByRole('group', { name: 'To' }).getByLabel('Time', { exact: true }).fill('13:45')
  await expect(form.getByRole('group', { name: 'From' }).getByLabel('Time zone')).toHaveValue('Asia/Tokyo')
  await expect(form.getByText('Takes 6h 15m')).toBeVisible()
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(panel.getByRole('button', { name: /Vietnam Airlines VN 300/ })).toBeVisible()
  expect(db.legs[0]).toMatchObject({ mode: 'flight', from_timezone: 'Asia/Tokyo', to_timezone: 'Asia/Ho_Chi_Minh', from_date: '2026-12-18' })
})

test('itinerary helpers: day order and labels', async () => {
  const { sortDays, dayTab, eachDate } = await import('../../src/lib/itineraryDays')
  expect(eachDate('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
  const days = sortDays([
    { id: 'x', trip_id: 't', date: null, note: null, created_at: '2026-10-10T12:00:05Z' },
    { id: 'b', trip_id: 't', date: '2026-12-19', note: null, created_at: '2026-10-10T12:00:01Z' },
    { id: 'a', trip_id: 't', date: '2026-12-18', note: null, created_at: '2026-10-10T12:00:02Z' }
  ])
  expect(days.map(d => d.id)).toEqual(['a', 'b', 'x'])
  expect(dayTab(days[0], 0)).toEqual({ top: 'Fri', main: 'Dec 18' })
  expect(dayTab(days[2], 2)).toEqual({ top: 'Extra', main: 'Day 3' })
})

/** Scroll the itinerary timeline so `minute` of the day sits near the top, then click there. */
async function clickTimeline(panel: import('@playwright/test').Locator, minute: number) {
  const tl = panel.getByTestId('day-timeline')
  await tl.evaluate((el, y) => { (el.parentElement as HTMLElement).scrollTop = Math.max(0, y - 40) }, minute)
  await tl.click({ position: { x: 200, y: minute } })
}

test('itinerary: day tabs wrap onto rows instead of scrolling sideways', async ({ page }) => {
  await fakeSupabase(page)
  await page.goto('./wander/trip/trip-saigon')
  await page.getByRole('button', { name: 'Open the itinerary' }).click()
  const tabs = page.getByRole('complementary', { name: 'Itinerary' }).getByRole('tablist', { name: 'Days' })
  await expect(tabs.getByRole('tab')).toHaveCount(16)
  const sideways = await tabs.evaluate(el => el.scrollWidth - el.clientWidth)
  expect(sideways, 'day tabs scroll sideways').toBeLessThanOrEqual(0)
  const first = (await tabs.getByRole('tab').first().boundingBox())!
  const last = (await tabs.getByRole('tab').last().boundingBox())!
  expect(last.y, 'tabs wrap onto more than one row').toBeGreaterThan(first.y)
})

test('itinerary: click a time to add an activity (15-minute mark, 30 minutes), edit and delete it', async ({ page }) => {
  const db = await fakeSupabase(page)
  await page.goto('./wander/trip/trip-saigon')
  await page.getByRole('button', { name: 'Open the itinerary' }).click()
  const panel = page.getByRole('complementary', { name: 'Itinerary' })
  // 15:20 is 15h20m = 920 px down; it snaps to 15:15.
  await clickTimeline(panel, 15 * 60 + 20)
  const pop = panel.getByRole('dialog', { name: 'Add at 15:15' })
  await expect(pop).toBeVisible()
  await expect(pop.getByLabel('Start')).toHaveValue('15:15')
  await expect(pop.getByLabel('End')).toHaveValue('15:45')
  await expect(pop.getByRole('radio', { name: /Place/ })).toBeVisible()
  await pop.getByRole('button', { name: 'Add' }).click()
  await expect(pop.getByRole('alert')).toHaveText('Say what the activity is.')
  await pop.getByRole('textbox', { name: 'What' }).fill('Massage at Miu Miu Spa')
  await pop.getByRole('button', { name: 'Add' }).click()
  const block = panel.getByRole('button', { name: /Massage at Miu Miu Spa, 15:15 to 15:45/ })
  await expect(block).toBeVisible()
  expect(db.acts[0]).toMatchObject({ title: 'Massage at Miu Miu Spa', start_time: '15:15', end_time: '15:45' })

  // Click (no drag) opens it to edit; rename, then delete.
  await block.click()
  const edit = panel.getByRole('dialog', { name: 'Edit activity' })
  await edit.getByRole('textbox', { name: 'What' }).fill('Massage and tea')
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(panel.getByRole('button', { name: /Massage and tea, 15:15 to 15:45/ })).toBeVisible()
  await panel.getByRole('button', { name: /Massage and tea/ }).click()
  await panel.getByRole('dialog', { name: 'Edit activity' }).getByRole('button', { name: 'Delete' }).click()
  await panel.getByRole('dialog', { name: 'Edit activity' }).getByRole('button', { name: 'Delete' }).click()
  await expect(panel.getByRole('button', { name: /Massage and tea/ })).toHaveCount(0)
  expect(db.acts).toHaveLength(0)
})

test('itinerary: drag an activity\'s bottom handle, top handle, and middle (5-minute steps)', async ({ page }, info) => {
  test.skip(info.project.name === 'phone', 'mouse dragging is checked on the larger screens')
  const db = await fakeSupabase(page)
  await page.goto('./wander/trip/trip-saigon')
  await page.getByRole('button', { name: 'Open the itinerary' }).click()
  const panel = page.getByRole('complementary', { name: 'Itinerary' })
  await clickTimeline(panel, 10 * 60 + 5)
  await panel.getByRole('dialog', { name: 'Add at 10:00' }).getByRole('textbox', { name: 'What' }).fill('Coffee')
  await panel.getByRole('dialog', { name: 'Add at 10:00' }).getByRole('button', { name: 'Add' }).click()
  const block = panel.getByRole('button', { name: /Coffee, 10:00 to 10:30/ })
  await expect(block).toBeVisible()
  const drag = async (y0: number, dy: number, x: number) => {
    await page.mouse.move(x, y0)
    await page.mouse.down()
    await page.mouse.move(x, y0 + dy / 2)
    await page.mouse.move(x, y0 + dy)
    await page.mouse.up()
  }
  let b = (await block.boundingBox())!
  // Bottom handle down 20 px = 20 min: ends 10:50.
  await drag(b.y + b.height - 3, 20, b.x + b.width / 2)
  await expect(panel.getByRole('button', { name: /Coffee, 10:00 to 10:50/ })).toBeVisible()
  b = (await panel.getByRole('button', { name: /Coffee/ }).boundingBox())!
  // Top handle down 10 px = 10 min: starts 10:10.
  await drag(b.y + 3, 10, b.x + b.width / 2)
  await expect(panel.getByRole('button', { name: /Coffee, 10:10 to 10:50/ })).toBeVisible()
  b = (await panel.getByRole('button', { name: /Coffee/ }).boundingBox())!
  // Middle down 60 px = 1 hour, same length.
  await drag(b.y + b.height / 2, 60, b.x + b.width / 2)
  await expect(panel.getByRole('button', { name: /Coffee, 11:10 to 11:50/ })).toBeVisible()
  await expect.poll(() => db.acts[0]).toMatchObject({ start_time: '11:10', end_time: '11:50' })
  await expect(panel.getByRole('dialog')).toHaveCount(0)
})

test('itinerary: Travel from the popup opens the travel form with the clicked times', async ({ page }) => {
  await fakeSupabase(page)
  await page.goto('./wander/trip/trip-saigon')
  await page.getByRole('button', { name: 'Open the itinerary' }).click()
  const panel = page.getByRole('complementary', { name: 'Itinerary' })
  await clickTimeline(panel, 8 * 60 + 40)
  const pop = panel.getByRole('dialog', { name: 'Add at 08:30' })
  await pop.getByRole('radio', { name: /Travel/ }).click()
  await pop.getByRole('button', { name: 'Next' }).click()
  const form = panel.getByRole('form', { name: 'Add travel' })
  await expect(form.getByRole('group', { name: 'From' }).getByLabel('Time', { exact: true })).toHaveValue('08:30')
  await expect(form.getByRole('group', { name: 'To' }).getByLabel('Time', { exact: true })).toHaveValue('09:00')
})

test('itinerary: drag maths', async () => {
  const { dragTimes, minuteAt, hhmm } = await import('../../src/lib/itineraryDays')
  expect(minuteAt(920, 60, 15)).toBe(915)
  expect(hhmm(915)).toBe('15:15')
  expect(dragTimes(600, 630, 22, 'bottom')).toEqual({ start: 600, end: 650 }) // 22 min rounds to 20
  expect(dragTimes(600, 630, 40, 'top')).toEqual({ start: 625, end: 630 }) // never shorter than 5 min
  expect(dragTimes(600, 630, -700, 'move')).toEqual({ start: 0, end: 30 }) // not before midnight
  expect(dragTimes(1400, 1430, 60, 'move')).toEqual({ start: 1409, end: 1439 }) // not past 23:59
})

test('itinerary: blocks that share time sit side by side; touching blocks share a column', async ({ page }) => {
  await fakeSupabase(page)
  await page.goto('./wander/trip/trip-saigon')
  await page.getByRole('button', { name: 'Open the itinerary' }).click()
  const panel = page.getByRole('complementary', { name: 'Itinerary' })
  const add = async (t: string, start: string, end: string) => {
    await clickTimeline(panel, 16 * 60 + 5)
    const d = panel.getByRole('dialog')
    await d.getByRole('textbox', { name: 'What' }).fill(t)
    await d.getByLabel('Start').fill(start)
    await d.getByLabel('End').fill(end)
    await d.getByRole('button', { name: 'Add' }).click()
    await expect(panel.getByRole('button', { name: new RegExp(`^${t},`) })).toBeVisible()
  }
  await add('Phở', '10:00', '10:30')
  await add('Bánh mì', '10:00', '10:30')
  await add('Market', '10:30', '11:00')
  await add('Lunch', '12:00', '12:30')
  const box = async (t: string) => (await panel.getByRole('button', { name: new RegExp(`^${t},`) }).boundingBox())!
  const [pho, banh, market, lunch] = [await box('Phở'), await box('Bánh mì'), await box('Market'), await box('Lunch')]
  expect(banh.x, 'same-time blocks sit side by side').toBeGreaterThan(pho.x + pho.width - 1)
  expect(Math.abs(market.x - pho.x), 'a block starting as another ends shares its column').toBeLessThan(2)
  expect(lunch.width, 'a block on its own takes the full width').toBeGreaterThan(pho.width * 1.8)
  // The title stays readable in a narrow column.
  await expect(panel.getByRole('button', { name: /^Bánh mì,/ }).locator('b')).toBeVisible()
})
