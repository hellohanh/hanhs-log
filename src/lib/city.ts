import { supabase } from './supabase'
import { mapQuery, type MapFields, type TripPlace } from './trips'

// Where a trip's map opens (M3 step 3, reworked session 4): the trip's
// Primary City in its Country, opened on its centre at zoom 13. It's looked up
// with Google Places when the trip is saved (the form shows the match first)
// and stored on the trip, so later opens need no lookup.

export { distanceKm, HCMC_CENTRE } from './cityName'

export interface City {
  query: string
  label: string | null
  lat: number
  lng: number
  north: number | null
  south: number | null
  east: number | null
  west: number | null
}

export function toMapFields(c: City): MapFields {
  return {
    map_query: c.query,
    map_label: c.label,
    map_lat: c.lat,
    map_lng: c.lng,
    map_north: c.north,
    map_south: c.south,
    map_east: c.east,
    map_west: c.west
  }
}

export const hasPlacesKey = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY)

/** Look a city up with Google Places (New). Null when it can't be found. */
export async function lookupCity(query: string): Promise<City | null> {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!key || !query.trim()) return null
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.location,places.viewport,places.formattedAddress'
    },
    body: JSON.stringify({ textQuery: query, pageSize: 1 })
  })
  if (!res.ok) throw new Error(`Google couldn't look up "${query}" (${res.status}).`)
  const body = (await res.json()) as {
    places?: {
      formattedAddress?: string
      location?: { latitude: number; longitude: number }
      viewport?: { low: { latitude: number; longitude: number }; high: { latitude: number; longitude: number } }
    }[]
  }
  const p = body.places?.[0]
  if (!p?.location) return null
  return {
    query,
    label: p.formattedAddress ?? null,
    lat: p.location.latitude,
    lng: p.location.longitude,
    north: p.viewport?.high.latitude ?? null,
    south: p.viewport?.low.latitude ?? null,
    east: p.viewport?.high.longitude ?? null,
    west: p.viewport?.low.longitude ?? null
  }
}

type Row = Record<'map_query' | 'map_label', string | null> &
  Record<'map_lat' | 'map_lng' | 'map_north' | 'map_south' | 'map_east' | 'map_west', number | null>

/** The map place saved on a trip, or null if none is saved yet. */
export async function fetchTripCity(tripId: string): Promise<City | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('trips')
    .select('map_query, map_label, map_lat, map_lng, map_north, map_south, map_east, map_west')
    .eq('id', tripId)
    .limit(1)
  if (error) return null
  const r = ((data ?? []) as Row[])[0]
  if (!r || r.map_query == null || r.map_lat == null || r.map_lng == null) return null
  return { query: r.map_query, label: r.map_label, lat: r.map_lat, lng: r.map_lng, north: r.map_north, south: r.map_south, east: r.map_east, west: r.map_west }
}

/**
 * Where a trip's map opens: the saved place if it still matches the trip's
 * Primary City and Country, otherwise a fresh lookup that is then saved.
 */
export async function ensureTripCity(tripId: string, place: Pick<TripPlace, 'country' | 'city_primary'>): Promise<City | null> {
  if (!hasPlacesKey) return null
  const query = mapQuery(place)
  const saved = await fetchTripCity(tripId)
  if (saved && saved.query === query) return saved
  const found = await lookupCity(query)
  if (found && supabase) await supabase.from('trips').update(toMapFields(found)).eq('id', tripId)
  return found
}
