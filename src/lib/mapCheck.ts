/// <reference types="google.maps" />
// Map check (session 9, Hanh): tries every camera control on every map look,
// on the real Google map in the viewer's browser, and reports what Google
// actually did — so "should tilt work on Terrain?" is answered by Google, not
// guessed. Google's own looks are checked with GPins ON and OFF.

import { MAP_LOOKS, canHidePins, lookOptions, mapKind } from './mapStyles'

export type Result = 'ok' | 'no' | 'greyed'

export interface CheckRow {
  look: string
  gpins: 'ON' | 'OFF'
  map: string
  move: Result
  zoom: Result
  reset: Result
  tilt: Result
  rotate: Result
}

export interface CheckEnv {
  /** Show this look with GPins on or off; resolves once the request is made. */
  apply: (lookKey: string, pins: boolean) => void
  /** The live Google map right now (it's rebuilt when the kind of map changes). */
  getMap: () => google.maps.Map | null
  /** Back to the look, pins and view from before the check. */
  restore: () => void
  ids: { base?: string; noPins?: string }
  home: { center: google.maps.LatLngLiteral; zoom: number }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function idle(map: google.maps.Map, ms = 3000): Promise<void> {
  return new Promise(resolve => {
    const t = setTimeout(resolve, ms)
    google.maps.event.addListenerOnce(map, 'idle', () => { clearTimeout(t); resolve() })
  })
}

/** The cases: all 11 looks with GPins ON, plus Google's own looks with GPins OFF. */
export function checkCases(noPinsId: boolean): { key: string; pins: boolean }[] {
  const on = MAP_LOOKS.map(l => ({ key: l.key, pins: true }))
  const off = MAP_LOOKS.filter(l => !l.styles && canHidePins(l, noPinsId)).map(l => ({ key: l.key, pins: false }))
  return [...on, ...off]
}

export async function runMapCheck(env: CheckEnv, onRow: (r: CheckRow) => void): Promise<void> {
  try {
    for (const c of checkCases(Boolean(env.ids.noPins))) {
      const look = MAP_LOOKS.find(l => l.key === c.key)!
      const opts = lookOptions(look, c.pins, Boolean(env.ids.noPins))
      const greyed = mapKind(look, opts, env.ids).kind === 'flat'
      env.apply(c.key, c.pins)
      await sleep(900) // let React rebuild the map if its kind changed
      const map = env.getMap()
      if (!map) continue
      await idle(map)
      map.setCenter(env.home.center)
      map.setZoom(env.home.zoom)
      await idle(map, 1500)

      // Move: pan each way and check the centre moved.
      let move: Result = 'ok'
      for (const [x, y] of [[0, -150], [0, 150], [-150, 0], [150, 0]]) {
        const before = map.getCenter()!.toJSON()
        map.panBy(x, y)
        await idle(map, 1500)
        const after = map.getCenter()!.toJSON()
        if (Math.abs(after.lat - before.lat) + Math.abs(after.lng - before.lng) < 1e-7) move = 'no'
      }
      // Zoom in and out.
      const z = map.getZoom() ?? env.home.zoom
      map.setZoom(z + 1)
      await idle(map, 1500)
      const zin = map.getZoom() === z + 1
      map.setZoom(z)
      await idle(map, 1500)
      const zoom: Result = zin && map.getZoom() === z ? 'ok' : 'no'

      // Tilt up then down, rotate right then left (what Google accepts).
      let tilt: Result = 'greyed'
      let rotate: Result = 'greyed'
      if (!greyed) {
        map.setTilt(45)
        await idle(map, 1500)
        const up = (map.getTilt() ?? 0) > 0
        map.setTilt(0)
        await idle(map, 1500)
        tilt = up && (map.getTilt() ?? 0) === 0 ? 'ok' : 'no'
        map.setHeading(90)
        await idle(map, 1500)
        const right = Math.abs((map.getHeading() ?? 0) - 90) < 1
        map.setHeading(0)
        await idle(map, 1500)
        rotate = right && Math.abs(map.getHeading() ?? 0) < 1 ? 'ok' : 'no'
      }
      // Reset: back to the starting view, flat, north up.
      map.panBy(200, 120)
      await idle(map, 1500)
      map.setTilt(0)
      map.setHeading(0)
      map.setCenter(env.home.center)
      map.setZoom(env.home.zoom)
      await idle(map, 1500)
      const cc = map.getCenter()!.toJSON()
      const reset: Result =
        Math.abs(cc.lat - env.home.center.lat) < 1e-4 && Math.abs(cc.lng - env.home.center.lng) < 1e-4 && map.getZoom() === env.home.zoom ? 'ok' : 'no'

      const kind = map.getRenderingType?.() === google.maps.RenderingType.VECTOR ? 'Tilt map (vector)' : 'Flat map (raster)'
      onRow({ look: look.name, gpins: c.pins ? 'ON' : 'OFF', map: kind, move, zoom, reset, tilt, rotate })
    }
  } finally {
    env.restore()
  }
}
