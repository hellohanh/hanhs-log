// Itinerary types and pure day helpers (no database), kept apart so tests
// can use them directly.

export type LegMode = 'flight' | 'train' | 'bus' | 'personal'

export interface ItineraryDay {
  id: string
  trip_id: string
  date: string | null
  note: string | null
  created_at: string
}

export interface TravelLeg {
  id: string
  day_id: string
  mode: LegMode
  title: string | null
  carrier: string | null
  reference: string | null
  from_location: string
  from_date: string | null
  from_time: string | null
  from_timezone: string | null
  to_location: string
  to_date: string | null
  to_time: string | null
  to_timezone: string | null
}

export interface Activity {
  id: string
  day_id: string
  title: string
  start_time: string
  end_time: string
  note: string | null
}

// ---- Clicking and dragging on the timeline (Hanh, session 4) ----
// A click adds a block starting at the 15-minute mark under the pointer,
// 30 minutes long by default. Handles and moves step 5 minutes.

export const ADD_SNAP_MIN = 15
export const DRAG_SNAP_MIN = 5
export const NEW_BLOCK_MIN = 30
export const MIN_ACTIVITY_MIN = 5

/** Minute of the day at a pixel offset on the timeline, rounded down to `snap`. */
export function minuteAt(px: number, hourPx: number, snap: number): number {
  const m = Math.floor(((px / hourPx) * 60) / snap) * snap
  return Math.max(0, Math.min(24 * 60 - snap, m))
}

/** "HH:MM" for a minute of the day (24:00 shown as 23:59 so it stays a valid time). */
export function hhmm(min: number): string {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

/**
 * New start and end after dragging an activity by `deltaMin`: the top handle
 * moves the start, the bottom handle the end, the middle moves both. Steps of
 * DRAG_SNAP_MIN, never shorter than MIN_ACTIVITY_MIN, never past midnight.
 */
export function dragTimes(start: number, end: number, deltaMin: number, part: 'top' | 'bottom' | 'move'): { start: number; end: number } {
  const d = Math.round(deltaMin / DRAG_SNAP_MIN) * DRAG_SNAP_MIN
  const len = end - start
  if (part === 'move') {
    const s = Math.max(0, Math.min(24 * 60 - 1 - len, start + d))
    return { start: s, end: s + len }
  }
  if (part === 'top') return { start: Math.max(0, Math.min(end - MIN_ACTIVITY_MIN, start + d)), end }
  return { start, end: Math.min(24 * 60 - 1, Math.max(start + MIN_ACTIVITY_MIN, end + d)) }
}

/** Dated days first (by date), then undated days (in the order they were added). */
export function sortDays(days: ItineraryDay[]): ItineraryDay[] {
  return [...days].sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date)
    if (a.date) return -1
    if (b.date) return 1
    return a.created_at.localeCompare(b.created_at)
  })
}

/** Every date from start to end, inclusive (noon-anchored to avoid time-zone slips). */
export function eachDate(start: string, end: string): string[] {
  const out: string[] = []
  let cur = new Date(`${start}T12:00:00Z`)
  const last = new Date(`${end}T12:00:00Z`)
  while (cur <= last && out.length < 366) {
    out.push(cur.toISOString().slice(0, 10))
    cur = new Date(cur.getTime() + 86400000)
  }
  return out
}

/** Tab label: weekday + date for dated days, "Day N" (by position) for undated ones. */
export function dayTab(day: ItineraryDay, index: number): { top: string; main: string } {
  if (!day.date) return { top: 'Extra', main: `Day ${index + 1}` }
  const d = new Date(`${day.date}T12:00:00Z`)
  return {
    top: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
    main: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  }
}


// Places on days (session 4): a dropped/added place is a 60-minute block.
export const STOP_MIN = 60

/** Default start for a place added to a day: after the latest stop, else 9:00. */
export function nextStopStart(stops: { end_time: string }[]): number {
  const latest = stops.reduce((m, s) => Math.max(m, toMin(s.end_time)), 0)
  return Math.min(latest || 9 * 60, 24 * 60 - STOP_MIN)
}
