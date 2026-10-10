import { useEffect, useRef, useState } from 'react'
import { hasMapsKey, loadGoogleMaps } from '../lib/googleMaps'
import { MAP_LOOKS, canTilt, type MapLook } from '../lib/mapStyles'
import CameraControl from './wander/CameraControl'

// Preview only (never merged): the approved 3 × 4 camera control with the
// plan Hanh chose (session 4): Google's own looks (standard, Google dark,
// terrain, satellite) on the tilt map; hand-made looks on the flat map with
// tilt and rotate greyed out or hidden. The readout says what Google is doing.

const HOME = { center: { lat: 10.7769, lng: 106.7009 }, zoom: 13 }
type IdChoice = 'demo' | 'wanderlog'

export default function TiltTest() {
  const box = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [look, setLook] = useState<MapLook>(MAP_LOOKS[0])
  const [idChoice, setIdChoice] = useState<IdChoice>('demo')
  const [error, setError] = useState('')
  const [readout, setReadout] = useState('')
  const [flatMode, setFlatMode] = useState<'grey' | 'hide'>('grey')
  // Which kind of map this look needs: Google's own looks use the tilt map
  // (with our Map ID, light or Google's dark); hand-made looks need the flat
  // map, because Google ignores hand-made colours on a map with a Map ID.
  const kind = canTilt(look) ? (look.dark ? 'tilt-dark' : 'tilt') : 'flat'
  const mapRef = useRef<google.maps.Map | null>(null)

  // (Re)create the map when the Map ID choice or the kind of map changes: a
  // map's ID, rendering and colour scheme can't be changed after it's made.
  // The current centre and zoom carry over.
  useEffect(() => {
    let cancelled = false
    loadGoogleMaps().then(
      g => {
        if (cancelled || !g || !box.current) return
        const mapId = idChoice === 'demo' ? 'DEMO_MAP_ID' : import.meta.env.VITE_GOOGLE_MAP_ID || 'DEMO_MAP_ID'
        const prev = mapRef.current
        const view = prev ? { center: prev.getCenter()!.toJSON(), zoom: prev.getZoom() ?? HOME.zoom } : HOME
        const tiltMap = kind !== 'flat'
        const m = new g.maps.Map(box.current, {
          ...view,
          ...(tiltMap
            ? {
                mapId,
                renderingType: g.maps.RenderingType.VECTOR,
                colorScheme: kind === 'tilt-dark' ? g.maps.ColorScheme.DARK : g.maps.ColorScheme.LIGHT,
                tiltInteractionEnabled: true,
                headingInteractionEnabled: true
              }
            : { renderingType: g.maps.RenderingType.RASTER, styles: look.styles }),
          mapTypeId: look.mapTypeId,
          zoomControl: false,
          cameraControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy'
        })
        const update = () =>
          setReadout(
            `Rendering: ${m.getRenderingType()} · tilt ${Math.round(m.getTilt() ?? 0)}° · turned ${Math.round(m.getHeading() ?? 0)}° · zoom ${m.getZoom()}`
          )
        m.addListener('tilt_changed', update)
        m.addListener('heading_changed', update)
        m.addListener('zoom_changed', update)
        m.addListener('renderingtype_changed', update)
        update()
        mapRef.current = m
        setMap(m)
      },
      e => setError((e as Error).message)
    )
    return () => {
      cancelled = true
    }
    // Looks of the same kind are applied below without rebuilding.
  }, [idChoice, kind])

  useEffect(() => {
    if (!map) return
    map.setOptions(canTilt(look) ? { mapTypeId: look.mapTypeId } : { mapTypeId: look.mapTypeId, styles: look.styles ?? null })
  }, [map, look])

  return (
    <main className="segoe" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--site-header-h, 64px))' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 24px', background: 'var(--surface)', borderBottom: '1px solid var(--rule)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '6px 16px' }}>
          <strong style={{ fontSize: 20 }}>Tilt test</strong>
          <span style={{ color: 'var(--muted)', fontSize: 14 }}>Try the camera buttons (bottom right), then each look. Note which looks show their colours.</span>
        </div>
        <div role="group" aria-label="Map ID" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: 'var(--muted)' }}>Map ID:</span>
          {(['demo', 'wanderlog'] as IdChoice[]).map(c => (
            <button key={c} type="button" className={c === idChoice ? 'btn' : 'btn btn-quiet'} aria-pressed={c === idChoice} onClick={() => setIdChoice(c)}>
              {c === 'demo' ? "Google's test ID" : 'Our Map ID secret'}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Look" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {MAP_LOOKS.map((l, i) => (
            <button key={l.key} type="button" className={l.key === look.key ? 'btn' : 'btn btn-quiet'} aria-pressed={l.key === look.key} onClick={() => setLook(l)}>
              {i + 1}. {l.name}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Tilt buttons on hand-made looks" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: 'var(--muted)' }}>On hand-made looks, the tilt and rotate buttons are:</span>
          {(['grey', 'hide'] as const).map(f => (
            <button key={f} type="button" className={f === flatMode ? 'btn' : 'btn btn-quiet'} aria-pressed={f === flatMode} onClick={() => setFlatMode(f)}>
              {f === 'grey' ? 'Greyed out' : 'Hidden'}
            </button>
          ))}
        </div>
        <span role="status" style={{ fontSize: 14, fontWeight: 700 }}>
          {canTilt(look) ? 'Tilt map (Google look)' : 'Flat map (hand-made look): tilt and rotate unavailable'} · {readout}
        </span>
      </div>
      {!hasMapsKey && <p role="status" style={{ padding: 24 }}>This build has no Google Maps key. Open the preview link.</p>}
      {error && <p role="alert" style={{ padding: 24, color: 'var(--accent)' }}>{error}</p>}
      <div style={{ position: 'relative', flex: 1, minHeight: 360 }}>
        <div ref={box} style={{ position: 'absolute', inset: 0 }} />
        {map && <CameraControl map={map} home={HOME} tiltable={canTilt(look)} flatMode={flatMode} />}
      </div>
    </main>
  )
}
