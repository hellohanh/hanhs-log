import type { Badge } from './pinDraw'

// What a pin shows from everyone's WTG / VIS (Q3, session 4). No database
// or Google here, so the tests can check it directly.

export type Verdict = 'revisit' | 'second' | 'no'
export interface Review {
  pin_id: string
  user_id: string
  status: 'wtg' | 'vis'
  verdict: Verdict | null
  rating: number | null
  updated_at: string
}
export type MyReview = Pick<Review, 'status' | 'verdict' | 'rating'>

/**
 * The badge a pin shows: the most recent VIS verdict anyone gave (Hanh,
 * session 4: anyone's status shows, most recent wins), otherwise WTG.
 */
export function pinBadge(reviews: Review[]): Badge {
  const vis = reviews.filter(r => r.status === 'vis' && r.verdict).sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  return vis[0]?.verdict ?? 'wtg'
}

/** Average of everyone's ratings, to the nearest tenth (shown in the card only). */
export function averageRating(reviews: Review[]): number | null {
  const rs = reviews.map(r => r.rating).filter((x): x is number => x != null)
  if (rs.length === 0) return null
  return Math.round((rs.reduce((a, b) => a + b, 0) / rs.length) * 10) / 10
}

/**
 * Whether a pin is faded to 10% on the map (Hanh, session 4):
 * - the pin being edited is never faded;
 * - OTD Pins (itinerary open, toggle on) shows `otdPins` bright and fades the
 *   rest — it overrides Show all pins and the MICHELIN filter;
 * - otherwise Show all pins off fades everything, and the MICHELIN filter
 *   fades non-MICHELIN pins.
 */
export function pinFaded(
  pin: { id: string; michelin: string | null },
  s: { editing: boolean; otdPins: Set<string> | null; showAll: boolean; michelinOnly: boolean }
): boolean {
  if (s.editing) return false
  if (s.otdPins) return !s.otdPins.has(pin.id)
  return !s.showAll || (s.michelinOnly && !pin.michelin)
}

