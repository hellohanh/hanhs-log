// Smooth fly-over (Hanh, session 11): picking a place, clicking a list row and
// tapping a bubble glide the map instead of jumping. Far moves zoom out on the
// way and back in (an arc), so a hop between continents still reads as a
// flight. The path maths is pure so tests can import it (L38); glideTo drives
// Google's moveCamera frame by frame and falls back to a jump where it can't.

import { fromWorld, toWorld } from './mapCentre'

const TILE = 256

export interface Camera {
  lat: number
  lng: number
  zoom: number
}

/** The zoom that fits a box into a w × h px map with some padding (Web Mercator). */
export function zoomForBounds(b: { south: number; west: number; north: number; east: number }, w: number, h: number, pad = 40): number {
  const sw = toWorld({ lat: b.south, lng: b.west })
  const ne = toWorld({ lat: b.north, lng: b.east })
  let dx = ne.x - sw.x
  if (dx < 0) dx += TILE // across the 180° line
  const dy = Math.abs(sw.y - ne.y)
  const zx = dx > 0 ? Math.log2(Math.max(1, w - 2 * pad) / dx) : 21
  const zy = dy > 0 ? Math.log2(Math.max(1, h - 2 * pad) / dy) : 21
  return Math.max(1, Math.min(21, zx, zy))
}

/** The middle of a box (handles the 180° line). */
export function boundsCentre(b: { south: number; west: number; north: number; east: number }) {
  const sw = toWorld({ lat: b.south, lng: b.west })
  const ne = toWorld({ lat: b.north, lng: b.east })
  let ex = ne.x
  if (ex < sw.x) ex += TILE
  return fromWorld({ x: (sw.x + ex) / 2, y: (sw.y + ne.y) / 2 })
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/**
 * The camera part-way (t in 0..1) from `a` to `b` on a w-px-wide map.
 * If both ends don't fit on screen at the lower zoom, the path dips to a zoom
 * that shows both, then comes back in.
 */
export function glidePath(a: Camera, b: Camera, t: number, w: number): Camera {
  const e = ease(Math.min(1, Math.max(0, t)))
  const wa = toWorld(a)
  const wb = toWorld(b)
  let dx = wb.x - wa.x
  if (dx > TILE / 2) dx -= TILE
  if (dx < -TILE / 2) dx += TILE
  const dy = wb.y - wa.y
  const dist = Math.hypot(dx, dy) // world px at zoom 0
  const fitBoth = dist > 0 ? Math.log2(w / (dist * 1.3)) : 21
  const low = Math.min(a.zoom, b.zoom)
  const dip = Math.max(1, Math.min(low, fitBoth))
  // Zoom: straight line from a to b, pulled down to `dip` around the middle.
  const line = a.zoom + (b.zoom - a.zoom) * e
  const pull = (low - dip) * Math.sin(Math.PI * e)
  const zoom = line - pull
  const c = fromWorld({ x: wa.x + dx * e, y: wa.y + dy * e })
  return { lat: c.lat, lng: c.lng, zoom }
}

/** How long a glide takes: longer for bigger zoom changes, 0.6–1.8 s. */
export function glideMs(a: Camera, b: Camera, w: number): number {
  const mid = glidePath(a, b, 0.5, w)
  const travel = Math.abs(a.zoom - mid.zoom) + Math.abs(b.zoom - mid.zoom)
  return Math.round(Math.min(1800, 600 + travel * 140))
}

const running = new WeakMap<object, number>()

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** Glide `map` to a camera, or to fit a box. Starting a new glide cancels the old one. */
export function glideTo(
  map: google.maps.Map,
  to: { center: { lat: number; lng: number }; zoom: number } | { bounds: { south: number; west: number; north: number; east: number }; pad?: number; maxZoom?: number }
) {
  const div = map.getDiv()
  const w = div.clientWidth || 800
  const h = div.clientHeight || 600
  const target: Camera =
    'bounds' in to
      ? { ...boundsCentre(to.bounds), zoom: Math.min(to.maxZoom ?? 21, zoomForBounds(to.bounds, w, h, to.pad)) }
      : { ...to.center, zoom: to.zoom }
  const c = map.getCenter()
  const from: Camera = { lat: c?.lat() ?? target.lat, lng: c?.lng() ?? target.lng, zoom: map.getZoom() ?? target.zoom }
  const prev = running.get(map)
  if (prev) cancelAnimationFrame(prev)
  running.delete(map)
  const raster = map.getRenderingType?.() !== 'VECTOR'
  const jump = () => {
    map.setCenter({ lat: target.lat, lng: target.lng })
    map.setZoom(raster ? Math.round(target.zoom) : target.zoom)
  }
  if (typeof map.moveCamera !== 'function' || reducedMotion()) return jump()
  const ms = glideMs(from, target, w)
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / ms)
    const cam = glidePath(from, target, t, w)
    map.moveCamera({ center: { lat: cam.lat, lng: cam.lng }, zoom: t < 1 ? cam.zoom : raster ? Math.round(target.zoom) : target.zoom })
    if (t < 1) running.set(map, requestAnimationFrame(step))
    else running.delete(map)
  }
  running.set(map, requestAnimationFrame(step))
  // Stop gliding as soon as the person grabs the map.
  const stop = map.addListener('dragstart', () => {
    const id = running.get(map)
    if (id) cancelAnimationFrame(id)
    running.delete(map)
    stop.remove()
  })
  setTimeout(() => stop.remove(), ms + 100)
}
