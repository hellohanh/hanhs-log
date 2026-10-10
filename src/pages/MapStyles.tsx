import { useEffect, useRef, useState } from 'react'
import { hasMapsKey, loadGoogleMaps } from '../lib/googleMaps'
import { MAP_LOOKS } from '../lib/mapStyles'

// Preview only (never merged): every map look side by side as a real
// Google map, all moving together, so Hanh can pick one for the trip map.

const CITIES = [
  { name: 'Ho Chi Minh City', center: { lat: 10.7769, lng: 106.7009 } },
  { name: 'Hội An', center: { lat: 15.8801, lng: 108.338 } },
  { name: 'Rome', center: { lat: 41.8967, lng: 12.4822 } },
  { name: 'Tokyo', center: { lat: 35.6812, lng: 139.7671 } },
  { name: 'Paris', center: { lat: 48.8566, lng: 2.3522 } }
]

export default function MapStyles() {
  const [error, setError] = useState('')
  const [city, setCity] = useState(0)
  const boxes = useRef<(HTMLDivElement | null)[]>([])
  const maps = useRef<google.maps.Map[]>([])

  useEffect(() => {
    let syncing = false
    loadGoogleMaps().then(
      g => {
        if (!g) return
        maps.current = MAP_LOOKS.map((look, i) => {
          const m = new g.maps.Map(boxes.current[i]!, {
            center: CITIES[0].center,
            zoom: 12,
            mapTypeId: look.mapTypeId,
            styles: look.styles,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            gestureHandling: 'greedy'
          })
          return m
        })
        maps.current.forEach(m => {
          m.addListener('bounds_changed', () => {
            if (syncing) return
            syncing = true
            const c = m.getCenter()
            const z = m.getZoom()
            maps.current.forEach(o => {
              if (o !== m && c && z !== undefined) {
                o.setCenter(c)
                o.setZoom(z)
              }
            })
            syncing = false
          })
        })
      },
      e => setError((e as Error).message)
    )
  }, [])

  function goTo(i: number) {
    setCity(i)
    maps.current[0]?.setCenter(CITIES[i].center)
    maps.current[0]?.setZoom(12)
  }

  return (
    <main className="segoe" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '8px 24px' }}>
        <h1 style={{ fontSize: 40 }}>Map looks</h1>
        <p style={{ margin: 0, color: 'var(--muted)', maxWidth: '75ch' }}>
          Every map moves together. Drag or zoom any one to compare the same streets. Zoom 12 is the whole-city view the trip map opens at.
        </p>
      </div>
      <div role="group" aria-label="City" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {CITIES.map((c, i) => (
          <button
            key={c.name}
            type="button"
            className={i === city ? 'btn' : 'btn btn-quiet'}
            aria-pressed={i === city}
            onClick={() => goTo(i)}
          >
            {c.name}
          </button>
        ))}
      </div>
      {!hasMapsKey && <p role="status">This build has no Google Maps key, so the maps can't be shown here. Open the preview link.</p>}
      {error && <p role="alert" style={{ color: 'var(--accent)' }}>{error}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 560px), 1fr))', gap: 20 }}>
        {MAP_LOOKS.map((look, i) => (
          <figure key={look.key} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <figcaption style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <strong style={{ fontSize: 18 }}>{i + 1}. {look.name}</strong>
              <span style={{ color: 'var(--muted)', fontSize: 14 }}>{look.note}</span>
            </figcaption>
            <div
              ref={el => { boxes.current[i] = el }}
              style={{ height: 480, borderRadius: 12, border: '1px solid var(--rule)', background: 'var(--surface)', overflow: 'hidden' }}
            />
          </figure>
        ))}
      </div>
    </main>
  )
}
