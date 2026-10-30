import type { Locator, Page, Route } from '@playwright/test'

// A tiny stand-in for Supabase, for the browser tests. The test build points
// at https://test-project.supabase.co (ci.yml); every call to it is answered
// here, so tests never touch the live database. Who is *allowed* to do what
// is proven against the real rules by the security tests in tests/db.

export const ME = '11111111-1111-1111-1111-111111111111'
export const FRIEND = '22222222-2222-2222-2222-222222222222'
export const GUEST = '33333333-3333-3333-3333-333333333333'

export interface FakeTrip {
  id: string
  name: string
  country: string
  city_primary: string
  city_secondary: string | null
  city_tertiary: string | null
  start_date: string | null
  end_date: string | null
  owner_id: string | null
  created_at: string
  invite_token: string
  pins: { count: number }[]
}

export interface FakePerson {
  user_id: string
  display_name: string | null
  is_owner: boolean
  joined_at: string | null
}

export interface FakeDay { id: string; trip_id: string; date: string | null; repeat_after?: string | null; note: string | null; locked?: boolean; created_at: string }
export interface FakeLeg { id: string; day_id: string; [k: string]: unknown }
export type FakeRow = Record<string, unknown>

export interface FakeDb {
  trips: FakeTrip[]
  days: FakeDay[]
  legs: FakeLeg[]
  acts: FakeLeg[]
  stops: FakeLeg[]
  conns: FakeRow[]
  pins: FakeRow[]
  reviews: FakeRow[]
  eateries: FakeRow[]
  eateryReviews: FakeRow[]
  eateryPhotos: FakeRow[]
  /** The old-pin import queue (E71). */
  importItems: FakeRow[]
  /** Travel legs linked to other trips (0012). */
  legLinks: { leg_id: string; trip_id: string }[]
  savorPeople: FakePerson[]
  savorToken: string
  /** Dishes people added (0017). */
  customDishes: FakeRow[]
  /** Roaminglog spots and their WTG / VIS (0021). */
  spots: FakeRow[]
  spotReviews: FakeRow[]
  /** One invite link for several trips (0020). */
  bundles: { id: string; token: string; owner_id: string; trip_ids: string[]; created_at: string; stopped_at: string | null }[]
  /** People per trip id. Trips missing here answer "not allowed". */
  people: Record<string, FakePerson[]>
  myName: string | null
  calls: { method: string; path: string; url: string; body: string | null }[]
}

export const SAMPLE_TRIPS: FakeTrip[] = [
  { id: 'trip-past', name: 'Đà Nẵng & Hội An', country: 'Vietnam', city_primary: 'Đà Nẵng', city_secondary: 'Hội An', city_tertiary: null, start_date: '2025-07-03', end_date: '2025-07-10', owner_id: FRIEND, created_at: '2025-05-01T00:00:00Z', invite_token: 'tok-past', pins: [{ count: 28 }] },
  { id: 'trip-undated', name: 'Japan in spring', country: 'Japan', city_primary: 'Tokyo', city_secondary: 'Kyoto', city_tertiary: null, start_date: null, end_date: null, owner_id: ME, created_at: '2026-09-01T00:00:00Z', invite_token: 'tok-japan', pins: [{ count: 1 }] },
  { id: 'trip-rome', name: 'Rome long weekend', country: 'Italy', city_primary: 'Rome', city_secondary: null, city_tertiary: null, start_date: '2027-03-12', end_date: '2027-03-16', owner_id: FRIEND, created_at: '2026-08-01T00:00:00Z', invite_token: 'tok-rome', pins: [{ count: 17 }] },
  { id: 'trip-saigon', name: 'Christmas in Saigon', country: 'Vietnam', city_primary: 'Hồ Chí Minh City', city_secondary: null, city_tertiary: null, start_date: '2026-12-18', end_date: '2027-01-02', owner_id: ME, created_at: '2026-07-01T00:00:00Z', invite_token: 'tok-saigon', pins: [{ count: 42 }] }
]

export const SAMPLE_PEOPLE: Record<string, FakePerson[]> = {
  'trip-saigon': [
    { user_id: ME, display_name: 'Hanh', is_owner: true, joined_at: null },
    { user_id: FRIEND, display_name: 'Mai', is_owner: false, joined_at: '2026-10-02T15:00:00Z' },
    { user_id: GUEST, display_name: null, is_owner: false, joined_at: '2026-10-05T15:00:00Z' }
  ],
  'trip-rome': [
    { user_id: FRIEND, display_name: 'Mai', is_owner: true, joined_at: null },
    { user_id: ME, display_name: 'Hanh', is_owner: false, joined_at: '2026-08-02T15:00:00Z' }
  ],
  'trip-undated': [{ user_id: ME, display_name: 'Hanh', is_owner: true, joined_at: null }],
  'trip-past': [
    { user_id: FRIEND, display_name: 'Mai', is_owner: true, joined_at: null },
    { user_id: ME, display_name: 'Hanh', is_owner: false, joined_at: '2025-05-02T15:00:00Z' }
  ]
}

function fakeJwt(sub: string) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', exp: 4102444800 })}.sig`
}

function session(userId: string, anonymous = false) {
  return {
    access_token: fakeJwt(userId),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 4102444800,
    refresh_token: 'test-refresh',
    user: {
      id: userId, aud: 'authenticated', role: 'authenticated', is_anonymous: anonymous,
      email: anonymous ? '' : 'hanh@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z'
    }
  }
}

const deny = (route: Route, message: string) =>
  route.fulfill({ status: 400, json: { code: 'P0001', message, details: null, hint: null } })

/**
 * Answer Supabase calls from an in-memory copy of the data. `signedInAs`
 * stores a session first (null = signed out). Returns the fake database so
 * a test can look at what was sent.
 */
export async function fakeSupabase(
  page: Page,
  opts: { signedInAs?: string | null; trips?: FakeTrip[]; people?: Record<string, FakePerson[]>; myName?: string | null; pins?: FakeRow[]; reviews?: FakeRow[]; eateries?: FakeRow[]; eateryReviews?: FakeRow[]; eateryPhotos?: FakeRow[]; importItems?: FakeRow[]; savorPeople?: FakePerson[]; customDishes?: FakeRow[]; spots?: FakeRow[]; spotReviews?: FakeRow[]; bundles?: FakeDb['bundles'] } = {}
): Promise<FakeDb> {
  const me = opts.signedInAs === undefined ? ME : opts.signedInAs
  await page.clock.setFixedTime(new Date('2026-10-10T12:00:00'))
  if (me) {
    await page.addInitScript(s => localStorage.setItem('sb-test-project-auth-token', s), JSON.stringify(session(me)))
  }
  const db: FakeDb = {
    trips: structuredClone(opts.trips ?? SAMPLE_TRIPS),
    people: structuredClone(opts.people ?? SAMPLE_PEOPLE),
    myName: opts.myName === undefined ? 'Hanh' : opts.myName,
    days: [],
    legs: [],
    acts: [],
    stops: [],
    conns: [],
    pins: structuredClone(opts.pins ?? []),
    reviews: structuredClone(opts.reviews ?? []),
    eateries: structuredClone(opts.eateries ?? []),
    eateryReviews: structuredClone(opts.eateryReviews ?? []),
    eateryPhotos: structuredClone(opts.eateryPhotos ?? []),
    importItems: structuredClone(opts.importItems ?? []),
    legLinks: [],
    savorPeople: structuredClone(opts.savorPeople ?? [{ user_id: ME, display_name: 'Hanh', is_owner: true, joined_at: null }]),
    savorToken: 'savor-tok',
    customDishes: structuredClone(opts.customDishes ?? []),
    spots: structuredClone(opts.spots ?? []),
    spotReviews: structuredClone(opts.spotReviews ?? []),
    bundles: structuredClone(opts.bundles ?? []),
    calls: []
  }
  let currentUser = me

  await page.route('https://test-project.supabase.co/**', async route => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname
    const body = req.postData()
    db.calls.push({ method: req.method(), path, url: req.url(), body })
    const args = body ? JSON.parse(body) : {}
    const idEq = url.searchParams.get('id')?.replace('eq.', '')

    // Signing in without an email (guest joining by link).
    if (path === '/auth/v1/signup') {
      currentUser = '44444444-4444-4444-4444-444444444444'
      return route.fulfill({ json: session(currentUser, true) })
    }

    if (path === '/rest/v1/trips') {
      if (req.method() === 'GET') {
        const rows = idEq ? db.trips.filter(t => t.id === idEq) : db.trips
        return route.fulfill({ json: rows })
      }
      if (req.method() === 'POST') {
        db.trips.push({ id: 'trip-new', created_at: '2026-10-10T12:00:00Z', invite_token: 'tok-new', pins: [{ count: 0 }], ...args })
        return route.fulfill({ status: 201, body: '' })
      }
      if (req.method() === 'PATCH') {
        db.trips = db.trips.map(t => (t.id === idEq ? { ...t, ...args } : t))
        return route.fulfill({ status: 204, body: '' })
      }
      if (req.method() === 'DELETE') {
        db.trips = db.trips.filter(t => t.id !== idEq)
        return route.fulfill({ status: 204, body: '' })
      }
    }

    // Itinerary panel: days (with notes) and travel legs.
    if (path === '/rest/v1/itinerary_days') {
      const trip = url.searchParams.get('trip_id')?.replace('eq.', '')
      if (req.method() === 'GET') return route.fulfill({ json: db.days.filter(d => d.trip_id === trip) })
      if (req.method() === 'POST') {
        for (const r of Array.isArray(args) ? args : [args]) {
          db.days.push({ id: `day-${db.days.length + 1}`, note: null, created_at: `2026-10-10T12:00:${String(db.days.length).padStart(2, '0')}Z`, ...r })
        }
        return route.fulfill({ status: 201, body: '' })
      }
      if (req.method() === 'PATCH') {
        db.days = db.days.map(d => (d.id === idEq ? { ...d, ...args } : d))
        return route.fulfill({ status: 204, body: '' })
      }
      if (req.method() === 'DELETE') {
        db.days = db.days.filter(d => d.id !== idEq)
        db.legs = db.legs.filter(l => l.day_id !== idEq)
        return route.fulfill({ status: 204, body: '' })
      }
    }
    if (path === '/rest/v1/itinerary_activities') {
      if (req.method() === 'GET') {
        // One row by id (offline step 3 checks it before sending an edit).
        if (url.searchParams.get('id')) return route.fulfill({ json: db.acts.filter(x => x.id === idEq) })
        const ids = (url.searchParams.get('day_id') ?? '').replace(/^in\.\(|\)$/g, '').split(',').map(x => x.replace(/"/g, ''))
        return route.fulfill({ json: db.acts.filter(a => ids.includes(a.day_id)) })
      }
      if (req.method() === 'POST') {
        db.acts.push({ id: `act-${db.acts.length + 1}`, note: null, ...args })
        return route.fulfill({ status: 201, body: '' })
      }
      if (req.method() === 'PATCH') {
        db.acts = db.acts.map(a => (a.id === idEq ? { ...a, ...args } : a))
        return route.fulfill({ status: 204, body: '' })
      }
      if (req.method() === 'DELETE') {
        db.acts = db.acts.filter(a => a.id !== idEq)
        return route.fulfill({ status: 204, body: '' })
      }
    }
    // Copy all pins from one trip to another (0018): skips places already there.
    if (path === '/rest/v1/rpc/copy_trip_pins') {
      const { _from, _to } = args as { _from: string; _to: string }
      let copied = 0, skipped = 0
      for (const p of db.pins.filter(x => x.trip_id === _from)) {
        if (p.google_place_id && db.pins.some(x => x.trip_id === _to && x.google_place_id === p.google_place_id)) { skipped++; continue }
        const id = `${p.id}-copy`
        db.pins.push({ ...p, id, trip_id: _to })
        for (const r of db.reviews.filter(r => r.pin_id === p.id)) db.reviews.push({ ...r, pin_id: id })
        copied++
      }
      return route.fulfill({ json: { copied, skipped } })
    }
    // Pins (step 4) and each person's WTG / VIS.
    if (path === '/rest/v1/pins') {
      const trip = url.searchParams.get('trip_id')?.replace('eq.', '')
      if (req.method() === 'GET') return route.fulfill({ json: db.pins.filter(p => p.trip_id === trip) })
      if (req.method() === 'POST') {
        // One pin per Google place per trip (migration 0014).
        if (args.google_place_id && db.pins.some(p => p.trip_id === args.trip_id && p.google_place_id === args.google_place_id)) {
          return route.fulfill({ status: 409, json: { code: '23505', message: 'That place is already pinned on this trip.' } })
        }
        db.pins.push({ created_at: '2026-10-10T12:00:00Z', ...args })
        return route.fulfill({ status: 201, body: '' })
      }
      if (req.method() === 'PATCH') {
        db.pins = db.pins.map(p => (p.id === idEq ? { ...p, ...args } : p))
        return route.fulfill({ status: 204, body: '' })
      }
      if (req.method() === 'DELETE') {
        db.pins = db.pins.filter(p => p.id !== idEq)
        db.reviews = db.reviews.filter(r => r.pin_id !== idEq)
        return route.fulfill({ status: 204, body: '' })
      }
    }
    if (path === '/rest/v1/pin_reviews') {
      if (req.method() === 'GET') {
        const ids = (url.searchParams.get('pin_id') ?? '').replace(/^in\.\(|\)$/g, '').split(',').map(x => x.replace(/"/g, ''))
        return route.fulfill({ json: db.reviews.filter(r => ids.includes(r.pin_id as string)) })
      }
      if (req.method() === 'POST') {
        for (const r of Array.isArray(args) ? args : [args]) {
          db.reviews = db.reviews.filter(x => !(x.pin_id === r.pin_id && x.user_id === r.user_id))
          db.reviews.push({ ...r, updated_at: `2026-10-10T12:${String(db.calls.length % 60).padStart(2, '0')}:00Z` })
        }
        return route.fulfill({ status: 201, body: '' })
      }
    }
    // Places scheduled onto days (step 4).
    if (path === '/rest/v1/itinerary_stops') {
      if (req.method() === 'GET') {
        const ids = (url.searchParams.get('day_id') ?? '').replace(/^in\.\(|\)$/g, '').split(',').map(x => x.replace(/"/g, ''))
        return route.fulfill({ json: db.stops.filter(s => ids.includes(s.day_id)) })
      }
      if (req.method() === 'POST') {
        for (const r of Array.isArray(args) ? args : [args]) db.stops.push({ id: `stop-${db.stops.length + 1}`, note: null, ...r })
        return route.fulfill({ status: 201, body: '' })
      }
      if (req.method() === 'PATCH') {
        db.stops = db.stops.map(s => (s.id === idEq ? { ...s, ...args } : s))
        return route.fulfill({ status: 204, body: '' })
      }
      if (req.method() === 'DELETE') {
        db.stops = db.stops.filter(s => s.id !== idEq)
        return route.fulfill({ status: 204, body: '' })
      }
    }
    // Connectors between a day's stops (step 4).
    if (path === '/rest/v1/itinerary_connectors') {
      if (req.method() === 'GET') {
        const ids = (url.searchParams.get('day_id') ?? '').replace(/^in\.\(|\)$/g, '').split(',').map(x => x.replace(/"/g, ''))
        return route.fulfill({ json: db.conns.filter(c => ids.includes(c.day_id as string)) })
      }
      if (req.method() === 'POST') {
        // upsert on (from_stop_id, to_stop_id)
        for (const r of Array.isArray(args) ? args : [args]) {
          db.conns = db.conns.filter(c => !(c.from_stop_id === r.from_stop_id && c.to_stop_id === r.to_stop_id))
          db.conns.push({ id: `conn-${db.conns.length + 1}`, ...r })
        }
        return route.fulfill({ status: 201, body: '' })
      }
      if (req.method() === 'DELETE') {
        const from = url.searchParams.get('from_stop_id')?.replace('eq.', '')
        const to = url.searchParams.get('to_stop_id')?.replace('eq.', '')
        db.conns = db.conns.filter(c => !(c.from_stop_id === from && c.to_stop_id === to))
        return route.fulfill({ status: 204, body: '' })
      }
    }
    if (path === '/rest/v1/travel_legs') {
      if (req.method() === 'GET') {
        const list = (k: string) => (url.searchParams.get(k) ?? '').replace(/^in\.\(|\)$/g, '').split(',').map(x => x.replace(/"/g, ''))
        if (url.searchParams.get('id')) return route.fulfill({ json: db.legs.filter(l => list('id').includes(l.id)) })
        return route.fulfill({ json: db.legs.filter(l => list('day_id').includes(l.day_id)) })
      }
      if (req.method() === 'POST') {
        db.legs.push({ id: `leg-${db.legs.length + 1}`, ...args })
        return route.fulfill({ status: 201, body: '' })
      }
      if (req.method() === 'PATCH') {
        db.legs = db.legs.map(l => (l.id === idEq ? { ...l, ...args } : l))
        return route.fulfill({ status: 204, body: '' })
      }
      if (req.method() === 'DELETE') {
        db.legs = db.legs.filter(l => l.id !== idEq)
        return route.fulfill({ status: 204, body: '' })
      }
    }

    // Savorlog: the shared eatery catalogue and each person's review (0007).
    if (path === '/rest/v1/eateries') {
      if (req.method() === 'GET') return route.fulfill({ json: db.eateries.filter(e => !e.deleted_at) })
      if (req.method() === 'POST') {
        for (const r of Array.isArray(args) ? args : [args]) db.eateries.push({ created_at: '2026-10-11T12:00:00Z', deleted_at: null, ...r })
        return route.fulfill({ status: 201, body: '' })
      }
      if (req.method() === 'PATCH') {
        db.eateries = db.eateries.map(e => (e.id === idEq ? { ...e, ...args } : e))
        return route.fulfill({ status: 204, body: '' })
      }
    }
    // Roaminglog spots (0021): one shared catalogue, removal waits for the owner.
    if (path === '/rest/v1/spots') {
      if (req.method() === 'GET') return route.fulfill({ json: db.spots.filter(x => !x.deleted_at) })
      if (req.method() === 'POST') {
        for (const r of Array.isArray(args) ? args : [args]) {
          if (r.google_place_id && db.spots.some(x => x.google_place_id === r.google_place_id)) {
            return route.fulfill({ status: 409, json: { code: '23505', message: 'duplicate key value violates unique constraint "spots_place"' } })
          }
          db.spots.push({ created_at: '2026-10-19T12:00:00Z', deleted_at: null, ...r })
        }
        return route.fulfill({ status: 201, body: '' })
      }
      if (req.method() === 'PATCH') {
        db.spots = db.spots.map(x => (x.id === idEq ? { ...x, ...args } : x))
        return route.fulfill({ status: 204, body: '' })
      }
    }
    if (path === '/rest/v1/spot_reviews') {
      if (req.method() === 'GET') {
        const ids = (url.searchParams.get('spot_id') ?? '').replace(/^in\.\(|\)$/g, '').split(',').map(x => x.replace(/"/g, ''))
        return route.fulfill({ json: db.spotReviews.filter(r => ids.includes(r.spot_id as string)) })
      }
      if (req.method() === 'POST') {
        for (const r of Array.isArray(args) ? args : [args]) {
          db.spotReviews = db.spotReviews.filter(x => !(x.spot_id === r.spot_id && x.user_id === r.user_id))
          db.spotReviews.push({ ...r, updated_at: '2026-10-19T12:00:00Z' })
        }
        return route.fulfill({ status: 201, body: '' })
      }
    }
    if (path === '/rest/v1/rpc/request_spot_deletion') {
      db.spots = db.spots.map(x => (x.id === args._id ? { ...x, deleted_at: '2026-10-19T12:00:00Z' } : x))
      return route.fulfill({ status: 204, body: '' })
    }
    if (path === '/rest/v1/custom_dishes') {
      if (req.method() === 'GET') return route.fulfill({ json: db.customDishes })
      if (req.method() === 'POST') {
        for (const r of Array.isArray(args) ? args : [args]) db.customDishes.push(r)
        return route.fulfill({ status: 201, body: '' })
      }
    }
    if (path === '/rest/v1/eatery_reviews') {
      if (req.method() === 'GET') {
        const ids = (url.searchParams.get('eatery_id') ?? '').replace(/^in\.\(|\)$/g, '').split(',').map(x => x.replace(/"/g, ''))
        return route.fulfill({ json: db.eateryReviews.filter(r => ids.includes(r.eatery_id as string)) })
      }
      if (req.method() === 'POST') {
        for (const r of Array.isArray(args) ? args : [args]) {
          db.eateryReviews = db.eateryReviews.filter(x => !(x.eatery_id === r.eatery_id && x.user_id === r.user_id))
          db.eateryReviews.push({ ...r, updated_at: `2026-10-11T12:${String(db.calls.length % 60).padStart(2, '0')}:00Z` })
        }
        return route.fulfill({ status: 201, body: '' })
      }
    }
    if (path === '/rest/v1/rpc/claim_savorlog') return route.fulfill({ json: 'owner' })
    if (path === '/rest/v1/rpc/trip_eateries') return route.fulfill({ json: db.eateries.filter(e => !e.deleted_at) })
    if (path === '/rest/v1/rpc/savorlog_invite') return route.fulfill({ json: db.savorToken })
    if (path === '/rest/v1/rpc/reset_savorlog_invite') {
      db.savorToken = 'savor-reset'
      return route.fulfill({ json: db.savorToken })
    }
    if (path === '/rest/v1/rpc/savorlog_people') {
      return route.fulfill({ json: db.savorPeople.map(p => ({ ...p, is_me: p.user_id === currentUser })) })
    }
    if (path === '/rest/v1/rpc/join_savorlog_via_invite') {
      if (!db.savorPeople.some(p => p.user_id === currentUser)) {
        db.savorPeople.push({ user_id: currentUser!, display_name: null, is_owner: false, joined_at: '2026-10-11T12:00:00Z' })
      }
      return route.fulfill({ status: 204, body: '' })
    }
    if (path === '/rest/v1/rpc/remove_savorlog_member') {
      db.savorPeople = db.savorPeople.filter(p => p.user_id !== args._user)
      return route.fulfill({ status: 204, body: '' })
    }
    if (path === '/rest/v1/rpc/request_eatery_deletion') {
      db.eateries = db.eateries.map(e => (e.id === args._id ? { ...e, deleted_at: '2026-10-11T12:00:00Z' } : e))
      return route.fulfill({ status: 204, body: '' })
    }
    if (path === '/rest/v1/eatery_photos') {
      if (req.method() === 'GET') {
        const ids = (url.searchParams.get('eatery_id') ?? '').replace(/^in\.\(|\)$/g, '').split(',').map(x => x.replace(/"/g, ''))
        return route.fulfill({ json: db.eateryPhotos.filter(p => ids.includes(p.eatery_id as string)) })
      }
      if (req.method() === 'POST') {
        for (const r of Array.isArray(args) ? args : [args]) db.eateryPhotos.push({ ...r })
        return route.fulfill({ status: 201, body: '' })
      }
      if (req.method() === 'DELETE') {
        db.eateryPhotos = db.eateryPhotos.filter(p => p.id !== idEq)
        return route.fulfill({ status: 204, body: '' })
      }
    }

    // The old-pin import queue (0011): loaded once (duplicates ignored), then ticked off.
    if (path === '/rest/v1/pin_import_items') {
      if (req.method() === 'GET') return route.fulfill({ json: db.importItems })
      if (req.method() === 'POST') {
        for (const r of Array.isArray(args) ? args : [args]) {
          if (db.importItems.some(x => x.google_place_id === r.google_place_id)) continue
          db.importItems.push({ id: `imp-${db.importItems.length + 1}`, status: 'pending', saved_pin_id: null, saved_eatery_id: null, ...r })
        }
        return route.fulfill({ status: 201, body: '' })
      }
      if (req.method() === 'PATCH') {
        db.importItems = db.importItems.map(x => (x.id === idEq ? { ...x, ...args } : x))
        return route.fulfill({ status: 204, body: '' })
      }
    }

    // Travel legs linked to other trips (0012).
    if (path === '/rest/v1/rpc/link_travel_leg') {
      const leg = db.legs.find(l => l.id === args._leg)
      const date = (leg?.from_date as string | null) ?? null
      if (!leg || !date) return deny(route, 'the leg needs a departure date to be linked')
      if (!db.days.some(d => d.trip_id === args._trip && d.date === date && !d.repeat_after)) {
        db.days.push({ id: `day-${db.days.length + 1}`, trip_id: args._trip, date, note: null, created_at: '2026-10-13T12:00:00Z' })
      }
      if (!db.legLinks.some(k => k.leg_id === args._leg && k.trip_id === args._trip)) db.legLinks.push({ leg_id: args._leg, trip_id: args._trip })
      return route.fulfill({ json: db.days.find(d => d.trip_id === args._trip && d.date === date && !d.repeat_after)!.id })
    }
    if (path === '/rest/v1/rpc/trip_leg_links') {
      const tripOf = (legId: string) => db.days.find(d => d.id === db.legs.find(l => l.id === legId)?.day_id)?.trip_id
      const name = (id: string | undefined) => db.trips.find(t => t.id === id)?.name ?? ''
      const out = db.legLinks.filter(k => tripOf(k.leg_id) === args._trip).map(k => ({ leg_id: k.leg_id, direction: 'out', other_trip_id: k.trip_id, other_trip_name: name(k.trip_id) }))
      const inn = db.legLinks.filter(k => k.trip_id === args._trip).map(k => ({ leg_id: k.leg_id, direction: 'in', other_trip_id: tripOf(k.leg_id), other_trip_name: name(tripOf(k.leg_id)) }))
      return route.fulfill({ json: [...out, ...inn] })
    }

    if (path === '/rest/v1/profiles') {
      if (req.method() === 'GET') return route.fulfill({ json: db.myName ? [{ display_name: db.myName }] : [] })
      db.myName = args.display_name
      for (const list of Object.values(db.people)) {
        for (const p of list) if (p.user_id === currentUser) p.display_name = args.display_name
      }
      return route.fulfill({ status: 201, body: '' })
    }

    if (path === '/rest/v1/rpc/trip_people') {
      const list = db.people[args._trip]
      if (!list) return deny(route, 'not allowed: you are not on this trip')
      return route.fulfill({ json: list.map(p => ({ ...p, is_me: p.user_id === currentUser })) })
    }
    if (path === '/rest/v1/rpc/trip_people_counts') {
      return route.fulfill({ json: Object.entries(db.people).map(([trip_id, l]) => ({ trip_id, people: l.length })) })
    }
    if (path === '/rest/v1/rpc/remove_trip_member') {
      db.people[args._trip] = (db.people[args._trip] ?? []).filter(p => p.user_id !== args._user)
      return route.fulfill({ status: 204, body: '' })
    }
    if (path === '/rest/v1/rpc/reset_trip_invite') {
      const token = 'tok-reset'
      db.trips = db.trips.map(t => (t.id === args._trip ? { ...t, invite_token: token } : t))
      return route.fulfill({ json: token })
    }
    // One invite link for several trips (0020).
    if (path === '/rest/v1/rpc/create_trip_bundle') {
      const ids = (args as { _trips: string[] })._trips
      if (ids.some(id => db.trips.find(t => t.id === id)?.owner_id !== currentUser)) return deny(route, 'not allowed: you can only include trips you own')
      const token = `bundle-${db.bundles.length + 1}`
      db.bundles.push({ id: `b${db.bundles.length + 1}`, token, owner_id: currentUser!, trip_ids: ids, created_at: `2026-10-19T1${db.bundles.length}:00:00Z`, stopped_at: null })
      return route.fulfill({ json: token })
    }
    if (path === '/rest/v1/trip_bundles') {
      return route.fulfill({ json: db.bundles.filter(b => b.owner_id === currentUser && !b.stopped_at) })
    }
    if (path === '/rest/v1/rpc/stop_trip_bundle') {
      const b = db.bundles.find(x => x.id === (args as { _id: string })._id && x.owner_id === currentUser)
      if (!b) return deny(route, 'not allowed')
      b.stopped_at = '2026-10-19T12:00:00Z'
      return route.fulfill({ status: 204, body: '' })
    }
    if (path === '/rest/v1/rpc/trip_bundle_preview') {
      const b = db.bundles.find(x => x.token === (args as { _token: string })._token && !x.stopped_at)
      if (!b) return route.fulfill({ json: [] })
      return route.fulfill({ json: db.trips.filter(t => b.trip_ids.includes(t.id)).map(t => ({
        trip_id: t.id, name: t.name, start_date: t.start_date, end_date: t.end_date, from_name: 'Hanh',
        already: t.owner_id === currentUser || (db.people[t.id] ?? []).some(p => p.user_id === currentUser)
      })) })
    }
    if (path === '/rest/v1/rpc/join_trips_via_bundle') {
      const b = db.bundles.find(x => x.token === (args as { _token: string })._token && !x.stopped_at)
      if (!b) return deny(route, 'invalid or stopped invite link')
      let n = 0
      for (const id of b.trip_ids) {
        const list = (db.people[id] ??= [])
        if (!list.some(p => p.user_id === currentUser)) { list.push({ user_id: currentUser!, display_name: null, is_owner: false, joined_at: '2026-10-19T12:00:00Z' }); n++ }
      }
      return route.fulfill({ json: n })
    }
    if (path === '/rest/v1/rpc/join_trip_via_invite') {
      const trip = db.trips.find(t => t.invite_token === args._token)
      if (!trip) return deny(route, 'invalid invite token')
      const list = (db.people[trip.id] ??= [])
      if (!list.some(p => p.user_id === currentUser)) {
        list.push({ user_id: currentUser!, display_name: null, is_owner: false, joined_at: '2026-10-10T12:00:00Z' })
      }
      db.myName = null
      return route.fulfill({ json: trip.id })
    }
    return route.fulfill({ json: {} })
  })
  return db
}

/** Answer the Places panel's Google search with these places. */
export async function fakePlaces(page: Page, places: { id: string; name: string; address: string; lat: number; lng: number }[]) {
  await page.route('https://places.googleapis.com/**', route =>
    route.fulfill({
      json: {
        places: places.map(p => ({ id: p.id, displayName: { text: p.name }, formattedAddress: p.address, location: { latitude: p.lat, longitude: p.lng } }))
      }
    })
  )
}

/** Sets a 24-hour time picker (hour + minute menus, session 10) by its label. */
export async function setTime(scope: import('@playwright/test').Locator, label: string, hhmm: string): Promise<void> {
  const [h, m] = hhmm.split(':')
  await scope.getByRole('combobox', { name: `${label} hour`, exact: true }).selectOption(h)
  await scope.getByRole('combobox', { name: `${label} minute`, exact: true }).selectOption(m)
}

/** Checks a 24-hour time picker shows hh:mm. */
export async function expectTime(scope: import('@playwright/test').Locator, label: string, hhmm: string): Promise<void> {
  const { expect } = await import('@playwright/test')
  const [h, m] = hhmm.split(':')
  await expect(scope.getByRole('combobox', { name: `${label} hour`, exact: true })).toHaveValue(h)
  await expect(scope.getByRole('combobox', { name: `${label} minute`, exact: true })).toHaveValue(m)
}

/** Your trips' extra actions (session 15): the ☰ beside + New trip on
 * computers, the site's ☰ menu on phones. Opens it and returns the item. */
export async function tripAction(page: Page, name: RegExp | string): Promise<Locator> {
  const desk = page.getByRole('button', { name: 'More trip actions' })
  if (await desk.isVisible()) {
    await desk.click()
    return page.getByRole('menuitem', { name })
  }
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  return page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name })
}
