import { supabase } from './supabase'
import type { Michelin } from './pinDraw'
import type { Review } from './pinRules'

// The shared Savorlog eatery catalogue (migration 0007). Unlike pins, an
// eatery belongs to no trip: there is one catalogue, held by the Savorlog
// circle, browsed whole here and surfaced on a trip within 20 km of its
// cities. Each person keeps their own WTG / VIS review (eatery_reviews,
// the same shape as pin_reviews).

export interface Eatery {
  id: string
  google_place_id: string | null
  name: string
  address: string | null
  lat: number
  lng: number
  /** The food's country (a cuisine key from docs/pin-standard.md). */
  cuisine: string | null
  /** The main dish (a dish key under that cuisine), or null. */
  dish: string | null
  michelin: Michelin
  michelin_year: number | null
  street_food: boolean
  fine_dining: boolean
  /** 1–4 → $–$$$$, or null. */
  price: number | null
  note: string | null
  created_at?: string
}
export type EateryFields = Omit<Eatery, 'id' | 'created_at'>

/** A person's WTG / VIS for an eatery — pinRules' Review, keyed by eatery. */
export interface EateryReview extends Omit<Review, 'pin_id'> {
  eatery_id: string
}

function client() {
  if (!supabase) throw new Error("Sign-in isn't set up in this build.")
  return supabase
}

const COLUMNS =
  'id, google_place_id, name, address, lat, lng, cuisine, dish, michelin, michelin_year, street_food, fine_dining, price, note, created_at'

/** Every live eatery in the catalogue (the queued-for-deletion ones are hidden). */
export async function fetchCatalogue(): Promise<Eatery[]> {
  const { data, error } = await client().from('eateries').select(COLUMNS).is('deleted_at', null)
  if (error) throw new Error(error.message)
  return ((data ?? []) as Eatery[]).sort((a, b) => a.name.localeCompare(b.name))
}

export async function fetchEateryReviews(ids: string[]): Promise<EateryReview[]> {
  if (ids.length === 0) return []
  const { data, error } = await client()
    .from('eatery_reviews')
    .select('eatery_id, user_id, status, verdict, rating, updated_at')
    .in('eatery_id', ids)
  if (error) throw new Error(error.message)
  return ((data ?? []) as EateryReview[]).map(r => ({ ...r, rating: r.rating == null ? null : Number(r.rating) }))
}

/** Adds an eatery to the catalogue, or saves changes to one. Returns its id. */
export async function saveEatery(fields: EateryFields, id?: string): Promise<string> {
  if (id) {
    const { error } = await client().from('eateries').update(fields).eq('id', id)
    if (error) throw new Error(error.message)
    return id
  }
  const newId = crypto.randomUUID()
  const { error } = await client().from('eateries').insert({ id: newId, ...fields })
  if (error) throw new Error(error.message)
  return newId
}

/** Sets your own WTG / VIS for an eatery (eatery_reviews). */
export async function saveMyEateryReview(
  eateryId: string,
  userId: string,
  r: { status: 'wtg' | 'vis'; verdict: 'revisit' | 'second' | 'no' | null; rating: number | null }
): Promise<void> {
  const row = { eatery_id: eateryId, user_id: userId, status: r.status, verdict: r.status === 'vis' ? r.verdict : null, rating: r.status === 'vis' ? r.rating : null }
  const { error } = await client().from('eatery_reviews').upsert(row, { onConflict: 'eatery_id,user_id' })
  if (error) throw new Error(error.message)
}

/** Sends an eatery to the pending-deletion queue (the owner finalizes later). */
export async function requestEateryDeletion(id: string): Promise<void> {
  const { error } = await client().rpc('request_eatery_deletion', { _id: id })
  if (error) throw new Error(error.message)
}

/** Make the signed-in person the Savorlog circle's owner if it has no owner yet. */
export async function claimSavorlog(): Promise<void> {
  const { error } = await client().rpc('claim_savorlog')
  if (error) throw new Error(error.message)
}

// ---- the Savorlog circle's invite (migration 0009) ----

export function savorInviteUrl(token: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}savor/join/${token}`
}
export async function savorlogInvite(): Promise<string> {
  const { data, error } = await client().rpc('savorlog_invite')
  if (error) throw new Error(error.message)
  return data as string
}
export async function joinSavorlog(token: string): Promise<void> {
  const { error } = await client().rpc('join_savorlog_via_invite', { _token: token })
  if (error) throw new Error(error.message)
}
export async function savorlogPeople(): Promise<import('./trips').Person[]> {
  const { data, error } = await client().rpc('savorlog_people')
  if (error) throw new Error(error.message)
  return (data ?? []) as import('./trips').Person[]
}
export async function removeSavorlogMember(userId: string): Promise<void> {
  const { error } = await client().rpc('remove_savorlog_member', { _user: userId })
  if (error) throw new Error(error.message)
}
export async function resetSavorlogInvite(): Promise<string> {
  const { data, error } = await client().rpc('reset_savorlog_invite')
  if (error) throw new Error(error.message)
  return data as string
}

// ---- photos (migration 0008 + the "eatery-photos" Storage bucket) ----

export interface EateryPhoto {
  id: string
  eatery_id: string
  path: string
  sort: number
}
const BUCKET = 'eatery-photos'
export const MAX_PHOTOS = 3

export async function fetchEateryPhotos(ids: string[]): Promise<EateryPhoto[]> {
  if (ids.length === 0) return []
  const { data, error } = await client().from('eatery_photos').select('id, eatery_id, path, sort').in('eatery_id', ids)
  if (error) throw new Error(error.message)
  return ((data ?? []) as EateryPhoto[]).sort((a, b) => a.sort - b.sort)
}

/** The public URL of an uploaded photo. */
export function photoUrl(path: string): string {
  const c = client()
  return c.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/** Uploads a photo for an eatery and records it (next sort). Returns the row. */
export async function addEateryPhoto(eateryId: string, userId: string, file: File, sort: number): Promise<EateryPhoto> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${eateryId}/${crypto.randomUUID()}.${ext}`
  const up = await client().storage.from(BUCKET).upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false })
  if (up.error) throw new Error(up.error.message)
  const id = crypto.randomUUID()
  const { error } = await client().from('eatery_photos').insert({ id, eatery_id: eateryId, path, sort, created_by: userId })
  if (error) throw new Error(error.message)
  return { id, eatery_id: eateryId, path, sort }
}

export async function removeEateryPhoto(photo: EateryPhoto): Promise<void> {
  const { error } = await client().from('eatery_photos').delete().eq('id', photo.id)
  if (error) throw new Error(error.message)
  await client().storage.from(BUCKET).remove([photo.path]).catch(() => {}) // best-effort: the row is the source of truth
}

/** A Google place photo for an eatery that has none of its own, or null. */
export async function googlePhotoUrl(placeId: string): Promise<string | null> {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''
  if (!key || !placeId) return null
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?fields=photos&key=${key}`)
  if (!res.ok) return null
  const body = (await res.json()) as { photos?: { name: string }[] }
  const name = body.photos?.[0]?.name
  return name ? `https://places.googleapis.com/v1/${name}/media?maxWidthPx=800&key=${key}` : null
}

/** The reviews of one eatery, as pinRules' Review (so pinBadge / averageRating take them). */
export function asReviews(reviews: EateryReview[], eateryId: string): Review[] {
  return reviews.filter(r => r.eatery_id === eateryId).map(r => ({ ...r, pin_id: r.eatery_id }))
}

/** "$", "$$"… for a 1–4 price (null → ""). */
export function priceLabel(price: number | null): string {
  return price == null ? '' : '$'.repeat(price)
}
