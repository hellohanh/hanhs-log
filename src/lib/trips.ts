import { supabase } from './supabase'

// Trips live in Hanh's Log's own database (session 4; live Wanderlog is
// separate and untouched). The database's rules decide which ones a person
// sees: the trips they own plus the ones they joined by invite link.

import type { TripPlace } from './place'
export { mapQuery, placeLabel, type TripPlace } from './place'

const PLACE_COLUMNS = 'country, city_primary, city_secondary, city_tertiary'

export interface TripSummary extends TripPlace {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  owner_id: string | null
  created_at: string
  pinCount: number
}

export interface NewTrip extends TripPlace {
  name: string
  start_date: string | null
  end_date: string | null
}

type Row = Omit<TripSummary, 'pinCount'> & { pins?: { count: number }[] }

function client() {
  if (!supabase) throw new Error("Sign-in isn't set up in this build.")
  return supabase
}

export async function fetchTrips(): Promise<TripSummary[]> {
  const { data, error } = await client()
    .from('trips')
    .select(`id, name, ${PLACE_COLUMNS}, start_date, end_date, owner_id, created_at, pins(count)`)
  if (error) throw new Error(error.message)
  // Cards count sorted pins only (Hanh, session 4): every Hanh's Log pin is
  // sorted (its category is picked when it's added).
  return ((data ?? []) as Row[]).map(({ pins, ...t }) => ({ ...t, pinCount: pins?.[0]?.count ?? 0 }))
}

/** Map fields saved with a trip: where its map opens (see lib/city.ts). */
export type MapFields = Record<'map_query' | 'map_label', string | null> &
  Record<'map_lat' | 'map_lng' | 'map_north' | 'map_south' | 'map_east' | 'map_west', number | null>

export async function createTrip(trip: NewTrip, ownerId: string, map?: MapFields): Promise<string> {
  const id = crypto.randomUUID()
  const { error } = await client().from('trips').insert({ id, ...trip, ...(map ?? {}), owner_id: ownerId })
  if (error) throw new Error(error.message)
  return id
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

// ---- One trip, its people, sharing (milestone 3, step 2) ----

export interface Trip extends TripPlace {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  owner_id: string | null
  invite_token: string
}

export interface Person {
  user_id: string
  display_name: string | null
  is_owner: boolean
  is_me: boolean
  joined_at: string | null
}

export async function fetchTrip(id: string): Promise<Trip | null> {
  const { data, error } = await client()
    .from('trips')
    .select(`id, name, ${PLACE_COLUMNS}, start_date, end_date, owner_id, invite_token`)
    .eq('id', id)
    .limit(1)
  if (error) throw new Error(error.message)
  return ((data ?? []) as Trip[])[0] ?? null
}

export async function updateTrip(id: string, fields: NewTrip, map?: MapFields): Promise<void> {
  const { error } = await client().from('trips').update({ ...fields, ...(map ?? {}) }).eq('id', id)
  if (error) throw new Error(error.message)
}

/** Everyone on a trip (owner first), with first names. Only people on the trip may ask. */
export async function fetchPeople(tripId: string): Promise<Person[]> {
  const { data, error } = await client().rpc('trip_people', { _trip: tripId })
  if (error) throw new Error(error.message)
  return (data ?? []) as Person[]
}

/** People count for each trip you can see, keyed by trip id. */
export async function fetchPeopleCounts(): Promise<Record<string, number>> {
  const { data, error } = await client().rpc('trip_people_counts')
  if (error) throw new Error(error.message)
  const out: Record<string, number> = {}
  for (const r of (data ?? []) as { trip_id: string; people: number }[]) out[r.trip_id] = r.people
  return out
}

export async function removePerson(tripId: string, userId: string): Promise<void> {
  const { error } = await client().rpc('remove_trip_member', { _trip: tripId, _user: userId })
  if (error) throw new Error(error.message)
}

export async function resetInvite(tripId: string): Promise<string> {
  const { data, error } = await client().rpc('reset_trip_invite', { _trip: tripId })
  if (error) throw new Error(error.message)
  return data as string
}

/** Join with an invite code; returns the trip's id. */
export async function joinTrip(token: string): Promise<string> {
  const { data, error } = await client().rpc('join_trip_via_invite', { _token: token })
  if (error) throw new Error(error.message)
  return data as string
}

/** Sign in without an email, for someone joining by link (as Wanderlog does). */
export async function signInAsGuest(): Promise<void> {
  const { error } = await client().auth.signInAnonymously()
  if (error) throw new Error(error.message)
}

export function inviteUrl(token: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}wander/join/${token}`
}

// ---- Your first name (profiles) ----

export async function fetchMyName(userId: string): Promise<string | null> {
  const { data, error } = await client().from('profiles').select('display_name').eq('user_id', userId).limit(1)
  if (error) throw new Error(error.message)
  return ((data ?? []) as { display_name: string }[])[0]?.display_name ?? null
}

export async function saveMyName(userId: string, name: string): Promise<void> {
  const { error } = await client()
    .from('profiles')
    .upsert({ user_id: userId, display_name: name, updated_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
}

export function initials(name: string | null): string {
  const n = (name ?? '').trim()
  return n ? n[0].toUpperCase() : '?'
}

/** Avatar colours for people on a trip, in list order. */
export const AVATAR_COLORS = ['#9E2A2B', '#378ADD', '#639922', '#BA7517', '#7F77DD', '#1D9E75']
