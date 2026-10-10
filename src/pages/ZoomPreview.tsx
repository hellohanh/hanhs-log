import { useEffect, useRef, useState } from 'react'
import { hasMapsKey, loadGoogleMaps } from '../lib/googleMaps'
import { readLook } from '../lib/mapStyles'
import { useIsDark } from '../lib/theme'

// Preview only (never merged): three cities at the trip map's real size
// (the window minus the 320px Places column and the trip bar), opening at
// the proposed default zoom, so Hanh can confirm it.

const CITIES = [
  { name: 'Hồ Chí Minh City', center: { lat: 10.7769, lng: 106.7009 } },
  { name: 'Tokyo', center: { lat: 35.6812, lng: 139.7671 } },
  { name: 'Albuquerque', center: { lat: 35.0844, lng: -106.6504 } }
]
const ZOOMS = [9, 10, 11, 12]

export default function ZoomPreview() {
  const [zoom, setZoom] = useState(10)
  const [error, setError] = useState('')
  const boxes = useRef<(HTMLDivElement | null)[]>([])
  const maps = useRef<google.maps.Map[]>([])
  const dark = useIsDark()

  useEffect(() => {
    loadGoogleMaps().then(
      g => {
        if (!g) return
        const look = readLook(dark ? 'dark' : 'light')
        maps.current = CITIES.map((c, i) => new g.maps.Map(boxes.current[i]!, {
          center: c.center,
          zoom: 10,
          mapTypeId: look.mapTypeId,
          styles: look.styles,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy'
        }))
      },
      e => setError((e as Error).message)
    )
    // Created once; the look comes from this device's Map look pick.
  }, [])

  function pick(z: number) {
    setZoom(z)
    maps.current.forEach((m, i) => {
      m.setCenter(CITIES[i].center)
      m.setZoom(z)
    })
  }

  return (
    <main className="segoe" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px', padding: '16px 32px', background: 'var(--surface)', borderBottom: '1px solid var(--rule)' }}>
        <strong style={{ fontSize: 20 }}>Opening zoom</strong>
        <div role="group" aria-label="Zoom" style={{ display: 'flex', gap: 8 }}>
          {ZOOMS.map(z => (
            <button key={z} type="button" className={z === zoom ? 'btn' : 'btn btn-quiet'} aria-pressed={z === zoom} onClick={() => pick(z)}>
              {z === 10 ? 'Zoom 10 (proposed)' : `Zoom ${z}`}
            </button>
          ))}
        </div>
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>Each map is the trip map's real size on this screen. Scroll for the next city.</span>
      </div>
      {!hasMapsKey && <p role="status" style={{ padding: 32 }}>This build has no Google Maps key. Open the preview link.</p>}
      {error && <p role="alert" style={{ padding: 32, color: 'var(--accent)' }}>{error}</p>}
      {CITIES.map((c, i) => (
        <section key={c.name} style={{ display: 'flex', borderBottom: '1px solid var(--rule)' }}>
          <aside style={{ width: 320, flex: 'none', padding: '18px 20px', boxSizing: 'border-box', background: 'var(--surface)', borderRight: '1px solid var(--rule)' }}>
            <strong style={{ fontSize: 22 }}>{c.name}</strong>
            <p style={{ color: 'var(--muted)', fontSize: 15 }}>Map opens on the city centre at zoom {zoom}.</p>
          </aside>
          <div
            ref={el => { boxes.current[i] = el }}
            style={{ flex: 1, minWidth: 0, height: 'calc(100vh - var(--site-header-h, 64px) - 135px)', minHeight: 420, background: 'var(--ground)' }}
          />
        </section>
      ))}
    </main>
  )
}
