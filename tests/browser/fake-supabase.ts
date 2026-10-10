import type { Page, Route } from '@playwright/test'

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
  destination: string
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

export interface FakeDb {
  trips: FakeTrip[]
  /** People per trip id. Trips missing here answer "not allowed". */
  people: Record<string, FakePerson[]>
  myName: string | null
  calls: { method: string; path: string; url: string; body: string | null }[]
}

export const SAMPLE_TRIPS: FakeTrip[] = [
  { id: 'trip-past', name: 'Đà Nẵng & Hội An', destination: 'Đà Nẵng, Vietnam', start_date: '2025-07-03', end_date: '2025-07-10', owner_id: FRIEND, created_at: '2025-05-01T00:00:00Z', invite_token: 'tok-past', pins: [{ count: 28 }] },
  { id: 'trip-undated', name: 'Japan in spring', destination: 'Tokyo & Kyoto, Japan', start_date: null, end_date: null, owner_id: ME, created_at: '2026-09-01T00:00:00Z', invite_token: 'tok-japan', pins: [{ count: 1 }] },
  { id: 'trip-rome', name: 'Rome long weekend', destination: 'Rome, Italy', start_date: '2027-03-12', end_date: '2027-03-16', owner_id: FRIEND, created_at: '2026-08-01T00:00:00Z', invite_token: 'tok-rome', pins: [{ count: 17 }] },
  { id: 'trip-saigon', name: 'Christmas in Saigon', destination: 'Ho Chi Minh City, Vietnam', start_date: '2026-12-18', end_date: '2027-01-02', owner_id: ME, created_at: '2026-07-01T00:00:00Z', invite_token: 'tok-saigon', pins: [{ count: 42 }] }
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
  opts: { signedInAs?: string | null; trips?: FakeTrip[]; people?: Record<string, FakePerson[]>; myName?: string | null } = {}
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
