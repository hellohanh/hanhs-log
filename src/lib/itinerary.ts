import { supabase } from './supabase'

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
  const { data, error } = await client().from('itinerary_days').select('id, trip_id, date, note, created_at').eq('trip_id', tripId)
  if (error) throw new Error(error.message)
  return sortDays((data ?? []) as ItineraryDay[])
}

/** Adds a day for every trip date that doesn't have one yet. Returns true if any were added. */
export async function fillTripDates(tripId: string, start: string | null, end: string | null, days: ItineraryDay[]): Promise<boolean> {
  if (!start || !end) return false
  const have = new Set(days.map(d => d.date).filter(Boolean))
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

export async function deleteDay(dayId: string): Promise<void> {
  // Its travel legs go with it (the database cascades).
  const { error } = await client().from('itinerary_days').delete().eq('id', dayId)
  if (error) throw new Error(error.message)
}

export async function saveDayNote(dayId: string, note: string): Promise<void> {
  const { error } = await client().from('itinerary_days').update({ note: note.trim() || null }).eq('id', dayId)
  if (error) throw new Error(error.message)
}

const LEG_COLUMNS =
  'id, day_id, mode, title, carrier, reference, from_location, from_date, from_time, from_timezone, to_location, to_date, to_time, to_timezone'

/** Every travel leg on the trip's days (all days, so legs continuing past midnight show on the next day too). */
export async function fetchLegs(dayIds: string[]): Promise<TravelLeg[]> {
  if (dayIds.length === 0) return []
  const { data, error } = await client().from('travel_legs').select(LEG_COLUMNS).in('day_id', dayIds)
  if (error) throw new Error(error.message)
  return (data ?? []) as TravelLeg[]
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

// ---- Places on days: scheduled stops (migration 0005) ----

export interface Stop {
  id: string
  day_id: string
  pin_id: string
  start_time: string
  end_time: string
  note: string | null
}
export type StopFields = Omit<Stop, 'id'>

export async function fetchStops(dayIds: string[]): Promise<Stop[]> {
  if (dayIds.length === 0) return []
  const { data, error } = await client()
    .from('itinerary_stops')
    .select('id, day_id, pin_id, start_time, end_time, note')
    .in('day_id', dayIds)
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
