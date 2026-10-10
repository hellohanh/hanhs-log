import { useEffect, useRef, useState } from 'react'
import { hasMapsKey, loadGoogleMaps } from '../lib/googleMaps'
import { MAP_LOOKS, type MapLook } from '../lib/mapStyles'
import CameraControl from './wander/CameraControl'

// Preview only (never merged): tests the approved 3 × 4 camera control on
// Google's vector map (needed for tilt and rotate), and which of the 11 map
// looks still show on it. The readout says what Google is actually doing.

const HOME = { center: { lat: 10.7769, lng: 106.7009 }, zoom: 13 }
type IdChoice = 'demo' | 'wanderlog'

export default function TiltTest() {
  const box = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [look, setLook] = useState<MapLook>(MAP_LOOKS[0])
  const [idChoice, setIdChoice] = useState<IdChoice>('demo')
  const [error, setError] = useState('')
  const [readout, setReadout] = useState('')

  // (Re)create the map whenever the Map ID choice changes: a map's ID and
  // rendering can't be changed after it's made.
  useEffect(() => {
    let cancelled = false
    loadGoogleMaps().then(
      g => {
        if (cancelled || !g || !box.current) return
        const mapId = idChoice === 'demo' ? 'DEMO_MAP_ID' : import.meta.env.VITE_GOOGLE_MAP_ID || 'DEMO_MAP_ID'
        const m = new g.maps.Map(box.current, {
          ...HOME,
          mapId,
          renderingType: g.maps.RenderingType.VECTOR,
          tiltInteractionEnabled: true,
          headingInteractionEnabled: true,
          mapTypeId: look.mapTypeId,
          styles: look.styles,
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
        setMap(m)
      },
      e => setError((e as Error).message)
    )
    return () => {
      cancelled = true
    }
    // The look is applied separately below; only the Map ID rebuilds the map.
  }, [idChoice])

  useEffect(() => {
    map?.setOptions({ mapTypeId: look.mapTypeId, styles: look.styles ?? null })
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
        <span role="status" style={{ fontSize: 14, fontWeight: 700 }}>{readout}</span>
      </div>
      {!hasMapsKey && <p role="status" style={{ padding: 24 }}>This build has no Google Maps key. Open the preview link.</p>}
      {error && <p role="alert" style={{ padding: 24, color: 'var(--accent)' }}>{error}</p>}
      <div style={{ position: 'relative', flex: 1, minHeight: 360 }}>
        <div ref={box} style={{ position: 'absolute', inset: 0 }} />
        {map && <CameraControl map={map} home={HOME} />}
      </div>
    </main>
  )
}
