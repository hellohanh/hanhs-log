import { supabase } from './supabase'
import type { Michelin } from './pinDraw'
import { isSpot } from './pins'

// The itinerary panel's data (migration 0002): a trip's days (dated days
// for the trip's dates plus extra undated days), each day's note, and
// travel legs. Scheduled stops come with pins (step 4).

export type { LegMode, ItineraryDay, TravelLeg, Activity } from './itineraryDays'
export { sortDays, eachDate, dayTab } from './itineraryDays'
import { eachDate, sortDays, type Activity, type ItineraryDay, type TravelLeg } from './itineraryDays'

export type LegFields = Omit<TravelLeg, 'id'>

function client() {
  if (!supabase) throw new Error("Sign-in isn't set up in this build.")
  return supabase
}

export async function fetchDays(tripId: string): Promise<ItineraryDay[]> {
  const days = () => client().from('itinerary_days')
  // Newest columns first; until a migration has run, its column is missing, so
  // fall back a step: 0025 adds locked, 0013 added repeat_after.
  const tries = ['id, trip_id, date, repeat_after, note, locked, created_at', 'id, trip_id, date, repeat_after, note, created_at', 'id, trip_id, date, note, created_at']
  let data: ItineraryDay[] | null = null
  let error: { message: string } | null = null
  for (const cols of tries) {
    ;({ data, error } = await days().select(cols).eq('trip_id', tripId).returns<ItineraryDay[]>())
    if (!error || !/locked|repeat_after/.test(error.message)) break
  }
  if (error) throw new Error(error.message)
  return sortDays((data ?? []) as ItineraryDay[])
}

/** Lock or unlock a day for everyone on the trip (migration 0025). */
export async function setDayLocked(dayId: string, locked: boolean): Promise<void> {
  const { error } = await client().from('itinerary_days').update({ locked }).eq('id', dayId)
  if (error) throw new Error(/locked/.test(error.message) ? "The day lock isn't switched on yet (database update 0025 still waiting)." : error.message)
}

/** Adds a day for every trip date that doesn't have one yet. Returns true if any were added. */
export async function fillTripDates(tripId: string, start: string | null, end: string | null, days: ItineraryDay[]): Promise<boolean> {
  if (!start || !end) return false
  const have = new Set(days.filter(d => !d.repeat_after).map(d => d.date).filter(Boolean))
  const missing = eachDate(start, end).filter(d => !have.has(d))
  if (missing.length === 0) return false
  const { error } = await client().from('itinerary_days').insert(missing.map(date => ({ trip_id: tripId, date })))
  if (error) throw new Error(error.message)
  return true
}

export async function addExtraDay(tripId: string): Promise<void> {
  const { error } = await client().from('itinerary_days').insert({ trip_id: tripId, date: null })
  if (error) throw new Error(error.message)
}

/**
 * Keeps the repeat days (flights across the date line, migration 0013) in step
 * with the legs: adds the ones they need, removes unneeded ones that are
 * empty. Returns true if anything changed.
 */
export async function syncRepeatDays(
  tripId: string,
  days: ItineraryDay[],
  wanted: { date: string; after: string }[],
  isEmpty: (d: ItineraryDay) => boolean
): Promise<boolean> {
  const have = days.filter(d => d.repeat_after)
  const add = wanted.filter(w => !have.some(d => d.date === w.date && d.repeat_after === w.after))
  const drop = have.filter(d => !wanted.some(w => d.date === w.date && d.repeat_after === w.after) && isEmpty(d))
  for (const w of add) {
    const { error } = await client().from('itinerary_days').insert({ trip_id: tripId, date: w.date, repeat_after: w.after })
    // Another device added it first: fine. Migration 0013 not applied yet: no repeat days for now.
    if (error && /repeat_after/.test(error.message)) return false
    if (error && error.code !== '23505') throw new Error(error.message)
  }
  for (const d of drop) {
    const { error } = await client().from('itinerary_days').delete().eq('id', d.id)
    if (error) throw new Error(error.message)
  }
  return add.length + drop.length > 0
}

export async function deleteDay(dayId: string): Promise<void> {
  // Its travel legs go with it (the database cascades).
  const { error } = await client().from('itinerary_days').delete().eq('id', dayId)
  if (error) throw new Error(error.message)
}

export async function saveDayNote(dayId: string, note: string): Promise<void> {
  const { error } = await client().from('itinerary_days').update({ note: note.trim() || null }).eq('id', dayId)
  if (error) throw new Error(error.message)
}

const LEG_COLUMNS_OLD =
  'id, day_id, mode, title, carrier, reference, from_location, from_date, from_time, from_timezone, to_location, to_date, to_time, to_timezone'
const LEG_COLUMNS = `${LEG_COLUMNS_OLD}, note`

/** Loads legs with their note; before migration 0019 is applied there's no note column yet, so load as before. */
async function selectLegs(col: 'day_id' | 'id', ids: string[]): Promise<TravelLeg[]> {
  let { data, error } = await client().from('travel_legs').select(LEG_COLUMNS).in(col, ids).returns<TravelLeg[]>()
  if (error && /note/.test(error.message)) ({ data, error } = await client().from('travel_legs').select(LEG_COLUMNS_OLD).in(col, ids).returns<TravelLeg[]>())
  if (error) throw new Error(error.message)
  return (data ?? []) as TravelLeg[]
}

/** Every travel leg on the trip's days (all days, so legs continuing past midnight show on the next day too). */
export async function fetchLegs(dayIds: string[]): Promise<TravelLeg[]> {
  if (dayIds.length === 0) return []
  return selectLegs('day_id', dayIds)
}

// ---- Legs linked to other trips (migration 0012, session 9) ----

/** A link touching this trip: 'out' = this trip's leg also shows on another
 * trip; 'in' = another trip's leg shows here (read only). */
export interface LegLink {
  leg_id: string
  direction: 'out' | 'in'
  other_trip_id: string
  other_trip_name: string
}

export async function fetchLegLinks(tripId: string): Promise<LegLink[]> {
  const { data, error } = await client().rpc('trip_leg_links', { _trip: tripId })
  if (error) throw new Error(error.message)
  return (data ?? []) as LegLink[]
}

/** Legs by id (for legs linked in from another trip). */
export async function fetchLegsByIds(ids: string[]): Promise<TravelLeg[]> {
  if (ids.length === 0) return []
  return selectLegs('id', ids)
}

/** Shows a leg on another trip too (both must be yours); adds its day there if missing. */
export async function linkLeg(legId: string, tripId: string): Promise<void> {
  const { error } = await client().rpc('link_travel_leg', { _leg: legId, _trip: tripId })
  if (error) throw new Error(error.message)
}

export async function saveLeg(fields: LegFields, id?: string): Promise<void> {
  const { error } = id
    ? await client().from('travel_legs').update(fields).eq('id', id)
    : await client().from('travel_legs').insert(fields)
  if (error) throw new Error(error.message)
}

export async function deleteLeg(id: string): Promise<void> {
  const { error } = await client().from('travel_legs').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ---- Activity blocks (migration 0003) ----

export type ActivityFields = Omit<Activity, 'id'>

export async function fetchActivities(dayIds: string[]): Promise<Activity[]> {
  if (dayIds.length === 0) return []
  const { data, error } = await client()
    .from('itinerary_activities')
    .select('id, day_id, title, start_time, end_time, note')
    .in('day_id', dayIds)
  if (error) throw new Error(error.message)
  return (data ?? []) as Activity[]
}

export async function saveActivity(fields: Partial<ActivityFields>, id?: string): Promise<void> {
  const { error } = id
    ? await client().from('itinerary_activities').update(fields).eq('id', id)
    : await client().from('itinerary_activities').insert(fields)
  if (error) throw new Error(error.message)
}

export async function deleteActivity(id: string): Promise<void> {
  const { error } = await client().from('itinerary_activities').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ---- Places on days: scheduled stops (migration 0005, 0010) ----

// A stop is a trip pin, a shared Savorlog eatery (migration 0010) or a
// Roaminglog spot (0022): exactly one of pin_id / eatery_id / spot_id is set.
// The panel resolves them all into a StopItem so any place schedules onto a
// day alike. Spots look like pins in the Places panel, so a 'pin' that is
// really a spot is sent as a spot (stopTarget).
export type StopKind = 'pin' | 'eatery' | 'spot'

/** A pin or eatery flattened to what the itinerary needs: a name and category
 * path to draw it, coordinates for the day route, and MICHELIN for the label.
 * The panel builds these from the trip's pins and catalogue eateries. */
export interface StopItem {
  id: string
  kind: StopKind
  name: string
  lat: number
  lng: number
  michelin: Michelin
  category: string
  subcategory: string | null
  subsubcategory: string | null
}

export interface Stop {
  id: string
  day_id: string
  pin_id: string | null
  eatery_id: string | null
  spot_id?: string | null
  start_time: string
  end_time: string
  note: string | null
}
export type StopFields = Omit<Stop, 'id'>

/** The id a stop points at, whichever kind it is. */
export function stopTargetId(s: Pick<Stop, 'pin_id' | 'eatery_id' | 'spot_id'>): string {
  return (s.pin_id ?? s.eatery_id ?? s.spot_id) as string
}

/** A pin or eatery as a stop points at it: a drag token, and back. Pin ids
 * pass through unchanged (keeps older drag payloads working); eateries are
 * tagged so the two id spaces never collide in a drop handler. */
export function stopRef(kind: StopKind, id: string): string {
  return kind === 'eatery' ? `eatery:${id}` : id
}
export function parseStopRef(ref: string): { kind: StopKind; id: string } {
  return ref.startsWith('eatery:') ? { kind: 'eatery', id: ref.slice('eatery:'.length) } : { kind: 'pin', id: ref }
}
/** The insert target columns for a stop of this kind. */
export function stopTarget(kind: StopKind, id: string): { pin_id: string } | { eatery_id: string } | { spot_id: string } {
  if (kind === 'eatery') return { eatery_id: id }
  return kind === 'spot' || isSpot(id) ? { spot_id: id } : { pin_id: id }
}

export async function fetchStops(dayIds: string[]): Promise<Stop[]> {
  if (dayIds.length === 0) return []
  const stops = () => client().from('itinerary_stops')
  let { data, error } = await stops().select('id, day_id, pin_id, eatery_id, spot_id, start_time, end_time, note').in('day_id', dayIds).returns<Stop[]>()
  // Before migration 0022 is applied there's no spot_id yet: load as before.
  if (error && /spot_id/.test(error.message)) {
    ;({ data, error } = await stops().select('id, day_id, pin_id, eatery_id, start_time, end_time, note').in('day_id', dayIds).returns<Stop[]>())
  }
  if (error) throw new Error(error.message)
  return (data ?? []) as Stop[]
}

export async function saveStop(fields: Partial<StopFields>, id?: string): Promise<void> {
  const { error } = id
    ? await client().from('itinerary_stops').update(fields).eq('id', id)
    : await client().from('itinerary_stops').insert(fields)
  if (error) throw new Error(error.message)
}

export async function deleteStop(id: string): Promise<void> {
  const { error } = await client().from('itinerary_stops').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ---- Connectors between a day's stops (migration 0006) ----

export type ConnMode = 'walk' | 'drive' | 'transit' | 'bike'
export interface Connector {
  id: string
  day_id: string
  from_stop_id: string
  to_stop_id: string
  mode: ConnMode
}

export async function fetchConnectors(dayIds: string[]): Promise<Connector[]> {
  if (dayIds.length === 0) return []
  const { data, error } = await client()
    .from('itinerary_connectors')
    .select('id, day_id, from_stop_id, to_stop_id, mode')
    .in('day_id', dayIds)
  if (error) throw new Error(error.message)
  return (data ?? []) as Connector[]
}

/** Sets (or changes) the travel mode between two consecutive stops. */
export async function saveConnector(dayId: string, fromStopId: string, toStopId: string, mode: ConnMode): Promise<void> {
  const { error } = await client()
    .from('itinerary_connectors')
    .upsert({ day_id: dayId, from_stop_id: fromStopId, to_stop_id: toStopId, mode }, { onConflict: 'from_stop_id,to_stop_id' })
  if (error) throw new Error(error.message)
}

export async function clearConnector(fromStopId: string, toStopId: string): Promise<void> {
  const { error } = await client().from('itinerary_connectors').delete().eq('from_stop_id', fromStopId).eq('to_stop_id', toStopId)
  if (error) throw new Error(error.message)
}

// ---- Panel state on this device (Hanh, session 4: remember open and width) ----

export interface PanelState {
  open: boolean
  wide: boolean
}
const PANEL_KEY = 'hanhs-log-itinerary-panel'

export function readPanelState(): PanelState {
  try {
    const v = JSON.parse(localStorage.getItem(PANEL_KEY) ?? '{}') as Partial<PanelState>
    return { open: v.open === true, wide: v.wide === true }
  } catch {
    return { open: false, wide: false }
  }
}

export function savePanelState(s: PanelState): void {
  try {
    localStorage.setItem(PANEL_KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable: lasts for this visit only */
  }
}
