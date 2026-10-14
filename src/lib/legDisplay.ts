// How a travel leg's route line reads on its itinerary block (session 9,
// approved mockup): "AUSTIN (AUS) 06:00 CST (UTC−6) •••🛬••• LOS ANGELES (LAX)
// 07:46 PST (UTC−8)". CSS-free so tests can import it (L38).

import type { LegMode } from './itineraryDays'

/** "Austin / AUS" → "AUSTIN (AUS)"; a place with no code is just upper-cased. */
export function placeLabel(location: string): string {
  const m = location.trim().match(/^(.*?)\s*\/\s*([A-Za-z]{3})$/)
  return m ? `${m[1].toLocaleUpperCase()} (${m[2].toUpperCase()})` : location.trim().toLocaleUpperCase()
}

// US zones get their short name too (Hanh: "PST, MST, CST, EST, etc").
const US_ZONES = new Set([
  'America/New_York', 'America/Detroit', 'America/Indiana/Indianapolis', 'America/Kentucky/Louisville',
  'America/Chicago', 'America/Indiana/Knox', 'America/Menominee', 'America/North_Dakota/Center',
  'America/Denver', 'America/Boise', 'America/Phoenix',
  'America/Los_Angeles', 'America/Anchorage', 'America/Juneau', 'America/Adak', 'Pacific/Honolulu'
])

/** "CST (UTC−6)" for a US zone, "(UTC+7)" elsewhere, on that date (so CDT in summer); "" without a zone. */
export function zoneLabel(date: string | null, time: string | null, zone: string | null): string {
  if (!zone) return ''
  const at = new Date(`${date ?? '2026-01-15'}T${(time ?? '12:00').slice(0, 5)}:00Z`)
  const part = (style: 'short' | 'shortOffset') => {
    try {
      return new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: style }).formatToParts(at).find(p => p.type === 'timeZoneName')?.value ?? ''
    } catch {
      return ''
    }
  }
  const off = part('shortOffset')
  if (!off) return ''
  const utc = off === 'GMT' ? 'UTC' : off.replace('GMT', 'UTC').replace('-', '−')
  const short = US_ZONES.has(zone) ? part('short') : ''
  return short && !short.startsWith('GMT') ? `${short} (${utc})` : `(${utc})`
}

/** One end of the route: "AUSTIN (AUS) 06:00 CST (UTC−6)". */
export function endLabel(location: string, date: string | null, time: string | null, zone: string | null): string {
  return [placeLabel(location), time?.slice(0, 5), zoneLabel(date, time, zone)].filter(Boolean).join(' ')
}

/** The mode's emoji between the dots, and whether it's mirrored to face left → right (on Hanh's screen). */
export const MODE_EMOJI: Record<LegMode, { emoji: string; flip: boolean }> = {
  flight: { emoji: '🛬', flip: false },
  train: { emoji: '🚆', flip: false },
  bus: { emoji: '🚌', flip: true },
  personal: { emoji: '🚗', flip: true }
}
