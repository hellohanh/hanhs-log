import { supabase } from './supabase'
import type { Michelin } from './pinDraw'

// A trip's pins and everyone's WTG / VIS reviews (migration 0004), and the
// Google search box that finds a place to pin (Places API (New) Text Search).

export interface Pin {
  id: string
  trip_id: string
  google_place_id: string | null
  name: string
  address: string | null
  lat: number
  lng: number
  category: string
  subcategory: string | null
  subsubcategory: string | null
  michelin: Michelin
  michelin_year: number | null
  street_food: boolean
  fine_dining: boolean
  note: string | null
  created_at?: string
}
export type PinFields = Omit<Pin, 'id' | 'created_at'>

export { pinBadge, averageRating, type Verdict, type Review, type MyReview } from './pinRules'
import type { MyReview, Review } from './pinRules'

function client() {
  if (!supabase) throw new Error("Sign-in isn't set up in this build.")
  return supabase
}

const PIN_COLUMNS =
  'id, trip_id, google_place_id, name, address, lat, lng, category, subcategory, subsubcategory, michelin, michelin_year, street_food, fine_dining, note, created_at'

export async function fetchPins(tripId: string): Promise<Pin[]> {
  const { data, error } = await client().from('pins').select(PIN_COLUMNS).eq('trip_id', tripId)
  if (error) throw new Error(error.message)
  return ((data ?? []) as Pin[]).sort((a, b) => a.name.localeCompare(b.name))
}

export async function fetchReviews(pinIds: string[]): Promise<Review[]> {
  if (pinIds.length === 0) return []
  const { data, error } = await client().from('pin_reviews').select('pin_id, user_id, status, verdict, rating, updated_at').in('pin_id', pinIds)
  if (error) throw new Error(error.message)
  return ((data ?? []) as Review[]).map(r => ({ ...r, rating: r.rating == null ? null : Number(r.rating) }))
}

/** Adds a pin, or saves changes to one. Returns its id. */
export async function savePin(fields: PinFields, id?: string): Promise<string> {
  if (id) {
    const { error } = await client().from('pins').update(fields).eq('id', id)
    if (error) throw new Error(error.message)
    return id
  }
  const newId = crypto.randomUUID()
  const { error } = await client().from('pins').insert({ id: newId, ...fields })
  if (error) throw new Error(error.message)
  return newId
}

export async function deletePin(id: string): Promise<void> {
  const { error } = await client().from('pins').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Sets your own WTG / VIS for a pin. */
export async function saveMyReview(pinId: string, userId: string, r: MyReview): Promise<void> {
  const row = { pin_id: pinId, user_id: userId, status: r.status, verdict: r.status === 'vis' ? r.verdict : null, rating: r.status === 'vis' ? r.rating : null }
  const { error } = await client().from('pin_reviews').upsert(row, { onConflict: 'pin_id,user_id' })
  if (error) throw new Error(error.message)
}

// ---- Google search box ----

export interface FoundPlace {
  id: string
  name: string
  address: string | null
  lat: number
  lng: number
}

/** Up to 8 Google places matching the words typed, nearest the map's centre first. */
export async function searchPlaces(query: string, near?: { lat: number; lng: number }): Promise<FoundPlace[]> {
  // Without a key (local and test builds) Google refuses the search, and the
  // box says so; the browser tests answer it with their own stand-in.
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''
  if (!query.trim()) return []
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location'
    },
    body: JSON.stringify({
      textQuery: query,
      pageSize: 8,
      ...(near ? { locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 30000 } } } : {})
    })
  })
  if (!res.ok) throw new Error(`Google couldn't search for "${query}" (${res.status}).`)
  const body = (await res.json()) as {
    places?: { id: string; displayName?: { text: string }; formattedAddress?: string; location?: { latitude: number; longitude: number } }[]
  }
  return (body.places ?? [])
    .filter(p => p.location)
    .map(p => ({ id: p.id, name: p.displayName?.text ?? query, address: p.formattedAddress ?? null, lat: p.location!.latitude, lng: p.location!.longitude }))
}
