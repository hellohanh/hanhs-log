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

/** Make the signed-in person the Savorlog circle's owner if it has no owner yet. */
export async function claimSavorlog(): Promise<void> {
  const { error } = await client().rpc('claim_savorlog')
  if (error) throw new Error(error.message)
}

/** The reviews of one eatery, as pinRules' Review (so pinBadge / averageRating take them). */
export function asReviews(reviews: EateryReview[], eateryId: string): Review[] {
  return reviews.filter(r => r.eatery_id === eateryId).map(r => ({ ...r, pin_id: r.eatery_id }))
}

/** "$", "$$"… for a 1–4 price (null → ""). */
export function priceLabel(price: number | null): string {
  return price == null ? '' : '$'.repeat(price)
}
