// Pure helpers for the trip's city (no network), kept apart so tests can use them directly.

// Separators between cities in a Destination like "Saigon & Hội An" or
// "Rome / Florence". Commas are not split, so "Portland, Maine" and
// "Ho Chi Minh City, Vietnam" stay whole for the lookup.
const SEPARATORS = /\s*(?:&|\+|\/|;|→|\s+and\s+|\s+to\s+|\s+[–—]\s+)\s*/i

/** The first city named in a trip's Destination. */
export function firstCity(destination: string): string {
  const first = destination.split(SEPARATORS).find(part => part.trim() !== '')
  return (first ?? destination).trim()
}

/** Ho Chi Minh City's centre; the Districts overlay is offered within 20 km of it (E25). */
export const HCMC_CENTRE = { lat: 10.7769, lng: 106.7009 }

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = (d: number) => (d * Math.PI) / 180
  const dLat = r(b.lat - a.lat)
  const dLng = r(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

