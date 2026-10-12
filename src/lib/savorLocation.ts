import { mainlandBounds, within, type Bounds } from './countryBounds'

// The Savorlog location gate (E66): one smart search box that finds a country
// or a city (Google Places (New) Text Search). Picking one scopes the whole
// page to that place — a country to its mainland box, a city to zoom 13 at its
// centre with a 20 km radius. "Ask every visit": the page keeps no choice.

export interface LocationHit {
  id: string
  name: string
  sub: string | null // e.g. the country, under a city
  kind: 'country' | 'city' | 'other'
  lat: number
  lng: number
  viewport?: { low: { latitude: number; longitude: number }; high: { latitude: number; longitude: number } }
}

export interface Scope {
  kind: 'country' | 'city'
  name: string
  center: { lat: number; lng: number }
  /** A country's box (mainland, or a clamped fallback); a city filters by radius. */
  bounds?: Bounds
  /** True when a country fell back to clamped bounds (precise mainland not yet listed). */
  approx?: boolean
}

const RADIUS_M = 20000 // E12: a city is its centre + 20 km
const CLAMP_DEG = 25 // fallback: keep a country's box within ~25° of centre (drops territories)

function kindOf(types: string[]): LocationHit['kind'] {
  if (types.includes('country')) return 'country'
  if (types.some(t => ['locality', 'postal_town', 'administrative_area_level_1', 'administrative_area_level_2', 'colloquial_area'].includes(t))) return 'city'
  return 'other'
}

/** Up to 8 countries/cities matching the words typed. */
export async function searchLocations(query: string): Promise<LocationHit[]> {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''
  if (!query.trim()) return []
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.viewport'
    },
    body: JSON.stringify({ textQuery: query, pageSize: 8 })
  })
  if (!res.ok) throw new Error(`Google couldn't search for "${query}" (${res.status}).`)
  const body = (await res.json()) as {
    places?: { id: string; displayName?: { text: string }; formattedAddress?: string; location?: { latitude: number; longitude: number }; types?: string[]; viewport?: LocationHit['viewport'] }[]
  }
  return (body.places ?? [])
    .filter(p => p.location)
    .map(p => ({
      id: p.id,
      name: p.displayName?.text ?? query,
      sub: p.formattedAddress ?? null,
      kind: kindOf(p.types ?? []),
      lat: p.location!.latitude,
      lng: p.location!.longitude,
      viewport: p.viewport
    }))
    .filter(h => h.kind !== 'other')
}

/** Turn a picked country/city into the page's scope. */
export function resolveScope(hit: LocationHit): Scope {
  const center = { lat: hit.lat, lng: hit.lng }
  if (hit.kind === 'city') return { kind: 'city', name: hit.name, center }
  const listed = mainlandBounds(hit.name)
  if (listed) return { kind: 'country', name: hit.name, center, bounds: listed }
  // Fallback: clamp the Google viewport to ~25° around the centre so overseas
  // territories don't blow the frame out; precise mainland bounds added next.
  const v = hit.viewport
  const bounds: Bounds = {
    south: Math.max(v?.low.latitude ?? center.lat - 5, center.lat - CLAMP_DEG),
    north: Math.min(v?.high.latitude ?? center.lat + 5, center.lat + CLAMP_DEG),
    west: Math.max(v?.low.longitude ?? center.lng - 5, center.lng - CLAMP_DEG),
    east: Math.min(v?.high.longitude ?? center.lng + 5, center.lng + CLAMP_DEG)
  }
  return { kind: 'country', name: hit.name, center, bounds, approx: true }
}

function distM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = Math.PI / 180
  return 2 * 6371000 * Math.asin(Math.sqrt(
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2
  ))
}

/** Is an eatery inside the chosen place — a country's box, or 20 km of a city? */
export function inScope(e: { lat: number; lng: number }, scope: Scope): boolean {
  if (scope.kind === 'country' && scope.bounds) return within(scope.bounds, e.lat, e.lng)
  return distM(scope.center.lat, scope.center.lng, e.lat, e.lng) <= RADIUS_M
}
