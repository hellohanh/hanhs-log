import { cityOf, repeatFor } from './dateLine'
import type { ItineraryDay, TravelLeg } from './itineraryDays'

// Which city a trip day is in (session 13, E102): the home city — the Primary
// City the trip was made with — until a travel leg (any mode) lands somewhere
// else; from that leg's arrival date the day is in its arrival city, carried
// forward until the next leg. A date-line repeat day is where its flights land.
// An extra day with no date stays in the home city.

// Everything is placed on the trip's timeline as "date|kind|time": an ordinary
// day is kind 0; a date-line repeat day (and a flight landing on one) sits
// right after its departure date as kind 1, so the departure tab stays in the
// city it leaves from and the repeat tab is in the city it lands in.

/** Where a leg lands on the timeline, or null without a date. */
function landsAt(l: TravelLeg): string | null {
  const k = repeatFor(l)
  if (k) return `${k.after}|1|${l.to_time ?? ''}`
  const date = l.to_date ?? l.from_date
  return date ? `${date}|0|${l.to_time ?? l.from_time ?? ''}` : null
}

/** Where a day sits on the timeline (its end, so a leg landing that day counts). */
function dayAt(day: Pick<ItineraryDay, 'date' | 'repeat_after'>): string {
  return day.repeat_after ? `${day.repeat_after}|1|~` : `${day.date}|0|~`
}

/** The city a day is in, by name ("Seoul / ICN" legs give "Seoul"). */
export function dayCityName(day: Pick<ItineraryDay, 'date' | 'repeat_after'> | null, legs: TravelLeg[], home: string): string {
  if (!day?.date) return home
  const end = dayAt(day)
  const landed = legs
    .map(l => ({ l, at: landsAt(l) }))
    .filter((x): x is { l: TravelLeg; at: string } => x.at !== null && x.at <= end && cityOf(x.l.to_location) !== '')
    .sort((a, b) => a.at.localeCompare(b.at))
  const last = landed[landed.length - 1]
  return last ? cityOf(last.l.to_location) : home
}

/**
 * The day the button uses: the itinerary's open day; with the itinerary
 * closed, today while the trip is under way; otherwise none (the home city).
 */
export function dayForCity(days: ItineraryDay[], openDayId: string | null, today = localToday()): ItineraryDay | null {
  if (openDayId) return days.find(d => d.id === openDayId) ?? null
  return days.find(d => d.date === today && !d.repeat_after) ?? null
}

/** Today on this device, YYYY-MM-DD (kept here so tests needn't load the database client). */
function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
