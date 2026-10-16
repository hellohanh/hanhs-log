// Mainland bounding boxes for the Savorlog location gate (E66): a country is
// framed to its MAIN landmass only — far-flung territories (France's overseas,
// the USA's Alaska/Hawaii, Japan's Okinawa, etc.) are deliberately left out so
// the map doesn't zoom to the whole world. A maintained list, added to as new
// countries come up; a country not here falls back to its centre at a
// size-based zoom (resolveScope), and gets precise bounds added next.

export interface Bounds {
  south: number
  west: number
  north: number
  east: number
}

// Keyed by the lower-cased country name Google returns (plus common aliases).
const MAINLAND: Record<string, Bounds> = {
  vietnam: { south: 8.2, west: 102.1, north: 23.4, east: 109.6 },
  japan: { south: 30.9, west: 129.4, north: 45.6, east: 146.0 }, // Honshū–Hokkaidō–Kyūshū, not Okinawa
  thailand: { south: 5.6, west: 97.3, north: 20.5, east: 105.7 },
  cambodia: { south: 9.9, west: 102.3, north: 14.7, east: 107.7 },
  singapore: { south: 1.15, west: 103.6, north: 1.48, east: 104.1 },
  'south korea': { south: 34.3, west: 125.9, north: 38.65, east: 129.6 },
  italy: { south: 36.6, west: 6.6, north: 47.1, east: 18.6 },
  france: { south: 41.3, west: -5.2, north: 51.1, east: 9.6 }, // métropole only
  spain: { south: 36.0, west: -9.4, north: 43.8, east: 3.4 }, // Iberian Spain, not the Canaries
  'united states': { south: 24.5, west: -125.0, north: 49.4, east: -66.9 }, // contiguous 48
  usa: { south: 24.5, west: -125.0, north: 49.4, east: -66.9 },
  'united states of america': { south: 24.5, west: -125.0, north: 49.4, east: -66.9 }
}

export function mainlandBounds(country: string): Bounds | null {
  return MAINLAND[country.trim().toLowerCase()] ?? null
}

/** Is a point inside a box? (No antimeridian case for the countries we use.) */
export function within(b: Bounds, lat: number, lng: number): boolean {
  return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east
}

/** Is a point inside the map's visible area? Handles a view across the 180° line (Pacific). */
export function inView(b: Bounds, lat: number, lng: number): boolean {
  if (lat < b.south || lat > b.north) return false
  return b.west <= b.east ? lng >= b.west && lng <= b.east : lng >= b.west || lng <= b.east
}

/**
 * The places to list for the map's visible area (Munch List, and a trip's
 * Nom-Nom since session 13): those inside the view; before the map reports a
 * view, nothing — or everything when there's no map at all (no key).
 */
export function onScreen<T extends { lat: number; lng: number }>(items: T[], view: Bounds | null, hasMap: boolean): T[] {
  if (view) return items.filter(i => inView(view, i.lat, i.lng))
  return hasMap ? [] : items
}
