import { supabase } from './supabase'

// The trip's city (M3 step 3): the trip map opens on the first city named in
// the trip's Destination, fitted so the whole city shows. The city is looked
// up once with Google Places and saved on the trip (migration 0002).

export interface City {
  query: string
  lat: number
  lng: number
  north: number | null
  south: number | null
  east: number | null
  west: number | null
}

export { firstCity, distanceKm, HCMC_CENTRE } from './cityName'
import { firstCity } from './cityName'

/** Look a city up with Google Places (New). Null when it can't be found. */
export async function lookupCity(query: string): Promise<City | null> {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!key || !query) return null
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.location,places.viewport'
    },
    body: JSON.stringify({ textQuery: query, pageSize: 1 })
  })
  if (!res.ok) throw new Error(`Google couldn't look up "${query}" (${res.status}).`)
  const body = (await res.json()) as {
    places?: { location?: { latitude: number; longitude: number }; viewport?: { low: { latitude: number; longitude: number }; high: { latitude: number; longitude: number } } }[]
  }
  const p = body.places?.[0]
  if (!p?.location) return null
  return {
    query,
    lat: p.location.latitude,
    lng: p.location.longitude,
    north: p.viewport?.high.latitude ?? null,
    south: p.viewport?.low.latitude ?? null,
    east: p.viewport?.high.longitude ?? null,
    west: p.viewport?.low.longitude ?? null
  }
}

type Row = {
  city_query: string | null
  city_lat: number | null
  city_lng: number | null
  city_north: number | null
  city_south: number | null
  city_east: number | null
  city_west: number | null
}

/** The city saved on a trip, or null (none saved yet, or the database update hasn't run). */
export async function fetchTripCity(tripId: string): Promise<City | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('trips')
    .select('city_query, city_lat, city_lng, city_north, city_south, city_east, city_west')
    .eq('id', tripId)
    .limit(1)
  if (error) return null
  const row = ((data ?? []) as Row[])[0]
  if (!row || row.city_query == null || row.city_lat == null || row.city_lng == null) return null
  return { query: row.city_query, lat: row.city_lat, lng: row.city_lng, north: row.city_north, south: row.city_south, east: row.city_east, west: row.city_west }
}

/** Save the city on the trip. Best effort: a failure only means it's looked up again next time. */
export async function saveTripCity(tripId: string, c: City): Promise<void> {
  if (!supabase) return
  await supabase
    .from('trips')
    .update({ city_query: c.query, city_lat: c.lat, city_lng: c.lng, city_north: c.north, city_south: c.south, city_east: c.east, city_west: c.west })
    .eq('id', tripId)
}

/**
 * The city a trip's map opens on: the saved one if it still matches the
 * Destination's first city, otherwise a fresh lookup that is then saved.
 */
export async function ensureTripCity(tripId: string, destination: string): Promise<City | null> {
  if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) return null
  const query = firstCity(destination)
  const saved = await fetchTripCity(tripId)
  if (saved && saved.query === query) return saved
  const found = await lookupCity(query)
  if (found) await saveTripCity(tripId, found).catch(() => undefined)
  return found
}
