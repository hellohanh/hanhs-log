// Centring in the part of the map you can see (Hanh, session 10): the
// itinerary panel sits over the right side of the trip map, so "the middle"
// is the middle of what's left of it. centreFor gives the map centre that
// puts a place dx px left of / dy px above the map's middle (Web Mercator,
// the projection Google uses), so a place lands mid-way in the visible part
// when dx is half the panel's width. Pure, so tests can import it (L38).

const TILE = 256

function toWorld(p: { lat: number; lng: number }) {
  const s = Math.min(Math.max(Math.sin((p.lat * Math.PI) / 180), -0.9999), 0.9999)
  return { x: ((p.lng + 180) / 360) * TILE, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE }
}

function fromWorld(w: { x: number; y: number }) {
  const lng = (w.x / TILE) * 360 - 180
  const n = Math.PI - (2 * Math.PI * w.y) / TILE
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n))
  return { lat, lng: ((lng + 540) % 360) - 180 }
}

/** The map centre that shows `target` dxPx left of and dyPx below the map's middle, at this zoom. */
export function centreFor(target: { lat: number; lng: number }, zoom: number, dxPx: number, dyPx = 0) {
  const scale = 2 ** zoom
  const w = toWorld(target)
  return fromWorld({ x: w.x + dxPx / scale, y: w.y - dyPx / scale })
}
