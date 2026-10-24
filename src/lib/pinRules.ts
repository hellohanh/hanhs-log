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
  s: { editing: boolean; otdPins: Set<string> | null; showAll: boolean; michelinOnly: boolean; picked?: Set<string> | null }
): boolean {
  if (s.editing) return false
  if (s.otdPins) return !s.otdPins.has(pin.id)
  const shown = s.showAll || Boolean(s.picked?.has(pin.id))
  return !shown || (s.michelinOnly && !pin.michelin)
}

// ---- The eye on each Places row (Hanh, session 10, approved mockup) ----
// Show all pins off → only the places whose eye is on show on the map, so
// you can show your hotel and the bánh mì spots together. An eye on a row
// (category, group, type, cuisine, dish or one place) turns everything under
// it on or off. Picking an eye while Show all is on switches Show all off and
// shows only that; ticking Show all clears the picks. Not remembered.

/** 'all' while Show all is on; otherwise on / part (some under it) / off. */
export type Eye = 'all' | 'on' | 'part' | 'off'

export function eyeState(ids: string[], picked: Set<string>, showAll: boolean): Eye {
  if (showAll) return 'all'
  const n = ids.filter(id => picked.has(id)).length
  return n === 0 ? 'off' : n === ids.length ? 'on' : 'part'
}

/** The picks after clicking an eye over these ids. */
export function togglePicks(picked: Set<string>, ids: string[], showAll: boolean): Set<string> {
  if (showAll) return new Set(ids)
  const next = new Set(picked)
  const allOn = ids.every(id => picked.has(id))
  for (const id of ids) allOn ? next.delete(id) : next.add(id)
  return next
}


/**
 * The MICHELIN chip hides, not fades (Hanh, session 14): with it on, every
 * non-MICHELIN pin leaves the map, so the numbered bubbles count MICHELIN
 * places only. The pin being edited and the Day route's own stops stay.
 */
export function michelinHidden(
  pin: { id: string; michelin: string | null },
  s: { editing: boolean; otdPins: Set<string> | null; michelinOnly: boolean }
): boolean {
  if (!s.michelinOnly || pin.michelin || s.editing) return false
  return !s.otdPins?.has(pin.id)
}

/**
 * Copy pins (session 14): how many of another trip's pins would be copied
 * here — a place already pinned here (same Google place) is skipped, as the
 * database does (copy_trip_pins, 0018).
 */
export function copyCounts(theirs: { google_place_id: string | null }[], mine: { google_place_id: string | null }[]) {
  const here = new Set(mine.map(p => p.google_place_id).filter(Boolean))
  const already = theirs.filter(p => p.google_place_id && here.has(p.google_place_id)).length
  return { total: theirs.length, already, toCopy: theirs.length - already }
}

// The popup's quick review (session 16, approved preview). Tapping the lit
// verdict again goes back to want to go; a rating means you've been, so with
// no verdict yet it counts as Revisit; tapping the same rating clears it.
export function afterVerdict(mine: MyReview, v: Verdict): MyReview {
  return mine.status === 'vis' && mine.verdict === v ? { status: 'wtg', verdict: null, rating: null } : { status: 'vis', verdict: v, rating: mine.rating }
}
export function afterRating(mine: MyReview, r: number | null): MyReview {
  return r === null ? { ...mine, rating: null } : { status: 'vis', verdict: mine.verdict ?? 'revisit', rating: r }
}
