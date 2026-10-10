import { supabase } from './supabase'

// Trips live in the same `trips` table as Wanderlog. The database's rules
// decide which ones a person sees: the trips they own plus the ones they
// joined by invite link.
export interface TripSummary {
  id: string
  name: string
  destination: string
  start_date: string | null
  end_date: string | null
  owner_id: string | null
  created_at: string
  pinCount: number
}

export interface NewTrip {
  name: string
  destination: string
  start_date: string | null
  end_date: string | null
}

type Row = Omit<TripSummary, 'pinCount'> & { pins: { count: number }[] | null }

function client() {
  if (!supabase) throw new Error("Sign-in isn't set up in this build.")
  return supabase
}

export async function fetchTrips(): Promise<TripSummary[]> {
  const { data, error } = await client()
    .from('trips')
    .select('id, name, destination, start_date, end_date, owner_id, created_at, pins(count)')
  if (error) throw new Error(error.message)
  return ((data ?? []) as Row[]).map(({ pins, ...t }) => ({ ...t, pinCount: pins?.[0]?.count ?? 0 }))
}

export async function createTrip(trip: NewTrip, ownerId: string): Promise<void> {
  const { error } = await client().from('trips').insert({ ...trip, owner_id: ownerId })
  if (error) throw new Error(error.message)
}

export async function deleteTrip(id: string): Promise<void> {
  // Pins, days, stops and travel legs go with it (the database cascades);
  // only the owner is allowed to do this.
  const { error } = await client().from('trips').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ---- Sorting and labels (pure, so they're easy to reason about) ----

/** Today's date as YYYY-MM-DD in the viewer's own time zone. */
export function todayISO(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** A trip is past once its end date is before today. No end date = upcoming. */
export function splitTrips(trips: TripSummary[], today: string) {
  const upcoming = trips.filter(t => !t.end_date || t.end_date >= today)
  const past = trips.filter(t => t.end_date && t.end_date < today)
  // Upcoming: soonest first, trips with no start date last.
  upcoming.sort((a, b) => {
    if (a.start_date && b.start_date) return a.start_date.localeCompare(b.start_date)
    if (a.start_date) return -1
    if (b.start_date) return 1
    return a.created_at.localeCompare(b.created_at)
  })
  // Past: most recent first.
  past.sort((a, b) => (b.end_date ?? '').localeCompare(a.end_date ?? ''))
  return { upcoming, past }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parts(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, label: `${MONTHS[m - 1]} ${d}` }
}

/**
 * "Dec 18 – Jan 2", with the year added when it isn't this year
 * ("Jul 3 – Jul 10, 2025"). One date only: "From Dec 18" / "Until Jan 2".
 */
export function tripDates(start: string | null, end: string | null, today: string): string {
  const thisYear = Number(today.slice(0, 4))
  if (!start && !end) return 'No dates yet'
  if (start && !end) {
    const s = parts(start)
    return `From ${s.label}${s.y !== thisYear ? `, ${s.y}` : ''}`
  }
  if (!start && end) {
    const e = parts(end)
    return `Until ${e.label}${e.y !== thisYear ? `, ${e.y}` : ''}`
  }
  const s = parts(start!)
  const e = parts(end!)
  if (s.y === e.y) return `${s.label} – ${e.label}${e.y !== thisYear ? `, ${e.y}` : ''}`
  return `${s.label}${s.y !== thisYear ? `, ${s.y}` : ''} – ${e.label}, ${e.y}`
}
