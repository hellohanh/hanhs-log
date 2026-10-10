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

