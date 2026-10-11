/// <reference types="google.maps" />
import { loadGoogleMaps } from './googleMaps'
import type { ConnMode } from './itinerary'

// A connector's time and distance from Google (Hanh, session 6). Fetched live
// each time the day is shown — never stored (decided session 6). Uses the
// Google Maps JS DirectionsService, like old Wanderlog, but one request per
// leg so each connector can have its own mode. Returns null when there's no
// Google (local/test builds) or no route.

export interface LegTime {
  minutes: number
  meters: number
  /** The route's path along the roads, for drawing the day route on the map. */
  path: google.maps.LatLngLiteral[]
}

/** One leg of the day route drawn on the map (session 6). */
export interface RouteSeg {
  from: google.maps.LatLngLiteral
  to: google.maps.LatLngLiteral
  /** The travel mode, or null when none is set yet (drawn as a dashed grey line). */
  mode: ConnMode | null
  /** Google's road path for the mode, or null (then a straight line is drawn). */
  path: google.maps.LatLngLiteral[] | null
}

const TRAVEL_MODE: Record<ConnMode, google.maps.TravelMode | 'DRIVING' | 'WALKING' | 'TRANSIT' | 'TWO_WHEELER'> = {
  walk: 'WALKING',
  drive: 'DRIVING',
  transit: 'TRANSIT',
  bike: 'TWO_WHEELER' // motorbike (Vietnam); falls back to bicycling where unsupported
}

let service: google.maps.DirectionsService | null = null

async function route(g: typeof google, req: google.maps.DirectionsRequest): Promise<LegTime | null> {
  service = service ?? new g.maps.DirectionsService()
  const res = await service.route(req)
  const r = res.routes[0]
  const leg = r?.legs[0]
  if (!r || !leg) return null
  return {
    minutes: Math.round((leg.duration?.value ?? 0) / 60),
    meters: Math.round(leg.distance?.value ?? 0),
    path: (r.overview_path ?? []).map(p => ({ lat: p.lat(), lng: p.lng() }))
  }
}

export async function computeLeg(
  from: google.maps.LatLngLiteral,
  to: google.maps.LatLngLiteral,
  mode: ConnMode
): Promise<LegTime | null> {
  const g = await loadGoogleMaps()
  if (!g) return null
  const travelMode = g.maps.TravelMode[TRAVEL_MODE[mode] as keyof typeof google.maps.TravelMode]
  try {
    return await route(g, { origin: from, destination: to, travelMode })
  } catch {
    // Motorbike isn't offered everywhere; try a bicycle route for "bike".
    if (mode === 'bike') {
      try {
        return await route(g, { origin: from, destination: to, travelMode: g.maps.TravelMode.BICYCLING })
      } catch {
        return null
      }
    }
    return null
  }
}

export { formatMinutes, formatMeters } from './itineraryLayout'

/** The route line colour per mode (matches the connector badges). */
export const MODE_COLOR: Record<ConnMode, string> = { walk: '#2F8A3E', drive: '#185FA5', transit: '#6A3FA0', bike: '#C8781E' }
