import { supabase } from './supabase'
import type { Michelin } from './pinDraw'
import { noVibes, type Vibes } from './vibe'

// A trip's pins and everyone's WTG / VIS reviews (migration 0004), and the
// Google search box that finds a place to pin (Places API (New) Text Search).

export interface Pin extends Vibes {
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
  note: string | null
  created_at?: string
  /** 'spot' = a Roaminglog spot (migration 0021/0022), shown on every trip;
   * otherwise one of this trip's own pins. */
  source?: 'pin' | 'spot'
}
export type PinFields = Omit<Pin, 'id' | 'created_at' | 'source'>

export { pinBadge, averageRating, pinFaded, type Verdict, type Review, type MyReview } from './pinRules'
import type { MyReview, Review } from './pinRules'

function client() {
  if (!supabase) throw new Error("Sign-in isn't set up in this build.")
  return supabase
}

const PIN_COLUMNS =
  'id, trip_id, google_place_id, name, address, lat, lng, category, subcategory, subsubcategory, michelin, michelin_year, street_food, fine_dining, dine_in, food_truck, outdoor_seating, community_seating, food_court, counter_seating, takeaway, note, created_at'

// Since session 14 the non-food places live in Roaminglog's shared spot
// catalogue (0021), not on one trip: every trip shows them all (Hanh's
// choice), shaped like pins so the map, lists and itinerary treat them alike.
// The trip keeps its own food pins. Which ids are spots is remembered here so
// the note, review and remove calls go to the right table.
const SPOT_COLUMNS = 'id, google_place_id, name, address, lat, lng, category, subcategory, subsubcategory, note, created_at'
const spotIds = new Set<string>()
export const isSpot = (id: string) => spotIds.has(id)
/** A non-food category belongs in Roaminglog. */
export const isSpotCategory = (category: string) => category !== 'food'

type SpotRow = Pick<Pin, 'id' | 'google_place_id' | 'name' | 'address' | 'lat' | 'lng' | 'category' | 'subcategory' | 'subsubcategory' | 'note' | 'created_at'>
function spotAsPin(s: SpotRow, tripId: string): Pin {
  return { ...s, ...noVibes(), trip_id: tripId, michelin: null, michelin_year: null, source: 'spot' }
}

async function fetchSpots(tripId: string): Promise<Pin[]> {
  const { data, error } = await client().from('spots').select(SPOT_COLUMNS).is('deleted_at', null)
  // Before 0021 is applied (or without access) the trip shows its own pins only.
  if (error || !Array.isArray(data)) return []
  return (data as SpotRow[]).map(s => spotAsPin(s, tripId))
}

export async function fetchPins(tripId: string): Promise<Pin[]> {
  const [{ data, error }, spots] = await Promise.all([
    client().from('pins').select(PIN_COLUMNS).eq('trip_id', tripId),
    fetchSpots(tripId)
  ])
  if (error) throw new Error(error.message)
  for (const s of spots) spotIds.add(s.id)
  // Until the move (0022) runs, a place can be both a pin and a spot: show it once.
  const spotPlaces = new Set(spots.map(s => s.google_place_id).filter(Boolean))
  const own = ((data ?? []) as Pin[])
    .filter(p => !(p.google_place_id && spotPlaces.has(p.google_place_id)))
    .map(p => ({ ...p, source: 'pin' as const }))
  return [...own, ...spots].sort((a, b) => a.name.localeCompare(b.name))
}

const toReview = (r: Review) => ({ ...r, rating: r.rating == null ? null : Number(r.rating) })

export async function fetchReviews(pinIds: string[]): Promise<Review[]> {
  const pinPart = pinIds.filter(id => !spotIds.has(id))
  const spotPart = pinIds.filter(id => spotIds.has(id))
  const out: Review[] = []
  if (pinPart.length > 0) {
    const { data, error } = await client().from('pin_reviews').select('pin_id, user_id, status, verdict, rating, updated_at').in('pin_id', pinPart)
    if (error) throw new Error(error.message)
    out.push(...((data ?? []) as Review[]).map(toReview))
  }
  if (spotPart.length > 0) {
    // Spot reviews in the same shape (pin_id = the spot's id). In chunks: the
    // ids go in the address and there can be hundreds of spots.
    for (let i = 0; i < spotPart.length; i += 150) {
      const { data, error } = await client().from('spot_reviews').select('spot_id, user_id, status, verdict, rating, updated_at').in('spot_id', spotPart.slice(i, i + 150))
      if (error) throw new Error(error.message)
      out.push(...((data ?? []) as (Omit<Review, 'pin_id'> & { spot_id: string })[]).map(({ spot_id, ...r }) => toReview({ ...r, pin_id: spot_id } as Review)))
    }
  }
  return out
}

function spotFields(f: PinFields) {
  const { google_place_id, name, address, lat, lng, category, subcategory, subsubcategory, note } = f
  return { google_place_id, name, address, lat, lng, category, subcategory, subsubcategory, note }
}

/** Adds a pin, or saves changes to one. Returns its id. A non-food place goes
 * to Roaminglog's spots (shared by every trip); a food place stays a trip pin. */
export async function savePin(fields: PinFields, id?: string): Promise<string> {
  // One pin per Google place per trip (0014, Hanh session 10); one spot per place (0021).
  const fail = (e: { code?: string; message: string }, spot: boolean) =>
    new Error(e.code === '23505' ? (spot ? 'That place is already in Roaminglog.' : 'That place is already pinned on this trip.') : e.message)
  const toSpot = isSpotCategory(fields.category)
  if (id && spotIds.has(id) && toSpot) {
    const { error } = await client().from('spots').update(spotFields(fields)).eq('id', id)
    if (error) throw fail(error, true)
    return id
  }
  if (id && !spotIds.has(id) && !toSpot) {
    const { error } = await client().from('pins').update(fields).eq('id', id)
    if (error) throw fail(error, false)
    return id
  }
  // New, or changing between food and non-food: add it where it now belongs,
  // then take the old one away.
  const newId = crypto.randomUUID()
  const { error } = toSpot
    ? await client().from('spots').insert({ id: newId, ...spotFields(fields) })
    : await client().from('pins').insert({ id: newId, ...fields })
  if (error) throw fail(error, toSpot)
  if (toSpot) spotIds.add(newId)
  if (id) await deletePin(id)
  return newId
}

/** Changes just a pin's note (the map popup's note, session 10). */
export async function savePinNote(id: string, note: string): Promise<void> {
  const { error } = await client().from(spotIds.has(id) ? 'spots' : 'pins').update({ note: note.trim() || null }).eq('id', id)
  if (error) throw new Error(error.message)
}

/** Removes a pin. A spot isn't deleted outright: it goes to the Savorlog
 * owner's removal queue (Hanh's choice) and leaves every trip meanwhile. */
export async function deletePin(id: string): Promise<void> {
  const { error } = spotIds.has(id)
    ? await client().rpc('request_spot_deletion', { _id: id })
    : await client().from('pins').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Sets your own WTG / VIS for a pin (or spot). */
export async function saveMyReview(pinId: string, userId: string, r: MyReview): Promise<void> {
  const body = { user_id: userId, status: r.status, verdict: r.status === 'vis' ? r.verdict : null, rating: r.status === 'vis' ? r.rating : null }
  const { error } = spotIds.has(pinId)
    ? await client().from('spot_reviews').upsert({ spot_id: pinId, ...body }, { onConflict: 'spot_id,user_id' })
    : await client().from('pin_reviews').upsert({ pin_id: pinId, ...body }, { onConflict: 'pin_id,user_id' })
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
