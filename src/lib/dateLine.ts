// Flights across the date line (Hanh, session 10, approved mockup): Seoul
// 18:45 Sun Jan 3 → Seattle 12:00 Sun Jan 3 lands "before" it left by the
// clock. The trip then lives Jan 3 twice, so the itinerary gets a repeat
// day: a second Jan 3 tab right after the first (migration 0013,
// itinerary_days.repeat_after). Added automatically, removed again when no
// flight needs it and nothing is on it. The flight splits: the Seoul tab
// shows it from departure to midnight, the Seattle tab from the departure
// moment in Seattle time (01:45) to landing. Each tab names the cities.
// CSS-free so tests can import it (L38).

import type { ItineraryDay, TravelLeg } from './itineraryDays'
import { utcOffsetMinutesAt, zonedWallTimeToUtcMs } from './itineraryLayout'

/** The wall-clock date and minute-of-day an instant reads in a time zone. */
export function localIn(ms: number, zone: string): { date: string; min: number } | null {
  const off = utcOffsetMinutesAt(new Date(ms), zone)
  if (off == null) return null
  const iso = new Date(ms + off * 60000).toISOString()
  return { date: iso.slice(0, 10), min: Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16)) }
}

export interface RepeatKey {
  /** The date the repeat tab shows (the landing date). */
  date: string
  /** The day it follows (the departure date). */
  after: string
}

/**
 * The repeat day a leg needs, or null. Only a flight that lands "before" it
 * left by the clock needs one: an earlier time on the same date, or an
 * earlier date (Seoul 18:45 Jan 3 → Seattle 12:00 Jan 3). That only happens
 * across the date line. A flight that just lands late, even after midnight
 * back home (Seoul 18:50 → Saigon 22:25), stays on its one day (Hanh,
 * session 10). Needs both dates, times and zones, and a real positive flight
 * time, so a typo can't add a day.
 */
export function repeatFor(leg: TravelLeg): RepeatKey | null {
  const { from_date, from_time, from_timezone, to_date, to_time, to_timezone } = leg
  if (!from_date || !from_time || !from_timezone || !to_date || !to_time || !to_timezone) return null
  const leaves = `${from_date}T${from_time.slice(0, 5)}`
  const lands = `${to_date}T${to_time.slice(0, 5)}`
  if (lands >= leaves) return null
  const leaveMs = zonedWallTimeToUtcMs(from_date, from_time, from_timezone)
  const landMs = zonedWallTimeToUtcMs(to_date, to_time, to_timezone)
  if (leaveMs == null || landMs == null || landMs <= leaveMs) return null
  return { date: to_date, after: from_date }
}

export const repeatId = (k: RepeatKey) => `${k.date}|${k.after}`

/** Every repeat day the legs need, one per landing date and departure date. */
export function wantedRepeats(legs: TravelLeg[]): RepeatKey[] {
  const m = new Map<string, RepeatKey>()
  for (const l of legs) {
    const k = repeatFor(l)
    if (k) m.set(repeatId(k), k)
  }
  return [...m.values()]
}

/** "Seoul / ICN" → "Seoul"; a place with no code stays as typed. */
export function cityOf(location: string): string {
  return location.replace(/\s*\/\s*[A-Za-z]{3}\s*$/, '').trim()
}

/** The legs a repeat day continues (it shows their landing part). */
export function legsOnRepeat(day: ItineraryDay, legs: TravelLeg[]): TravelLeg[] {
  if (!day.repeat_after || !day.date) return []
  return legs.filter(l => {
    const k = repeatFor(l)
    return k && k.date === day.date && k.after === day.repeat_after
  })
}

/**
 * The city lines under a tab's date: on a repeat day, where its flights
 * land; on the day before it, where those flights leave from. Every city
 * once, in departure-time order. Empty for every other day.
 */
export function tabCities(day: ItineraryDay, days: ItineraryDay[], legs: TravelLeg[]): string[] {
  const byTime = (a: TravelLeg, b: TravelLeg) => (a.from_time ?? '').localeCompare(b.from_time ?? '')
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))]
  if (day.repeat_after) return uniq(legsOnRepeat(day, legs).sort(byTime).map(l => cityOf(l.to_location)))
  if (!day.date) return []
  const repeats = days.filter(d => d.repeat_after === day.date)
  if (repeats.length === 0) return []
  return uniq(repeats.flatMap(r => legsOnRepeat(r, legs)).sort(byTime).map(l => cityOf(l.from_location)))
}

/** Where a date-line leg starts on its repeat tab: the departure moment in the landing zone (midnight if that's still the day before). */
export function repeatStartMin(leg: TravelLeg): number {
  const k = repeatFor(leg)
  if (!k) return 0
  const leaveMs = zonedWallTimeToUtcMs(leg.from_date!, leg.from_time!, leg.from_timezone!)
  const there = leaveMs == null ? null : localIn(leaveMs, leg.to_timezone!)
  return there && there.date === k.date ? there.min : 0
}

/** A repeat day is safe to remove when nothing is on it. */
export function repeatIsEmpty(day: ItineraryDay, has: { legs: TravelLeg[]; acts: { day_id: string }[]; stops: { day_id: string }[] }): boolean {
  return !day.note && !has.legs.some(l => l.day_id === day.id) && !has.acts.some(a => a.day_id === day.id) && !has.stops.some(s => s.day_id === day.id)
}

/** "Jan 3" for the continue notes on the blocks. */
export function shortDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}
