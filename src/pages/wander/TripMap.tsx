import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '../../lib/googleMaps'
import { MAP_LOOKS, readLook, saveLook, DEFAULT_LOOK, type MapLook, type Mode, type Swatch } from '../../lib/mapStyles'
import { distanceKm, HCMC_CENTRE, type City } from '../../lib/city'
import { useIsDark } from '../../lib/theme'
import styles from './TripMap.module.css'

// The trip map (M3 step 3, approved mockup v2, session 4): opens on the
// trip's city with the whole city showing, no pins yet (old Wanderlog pins
// appear only after Hanh sorts them). Map look switcher with 11 looks,
// remembered per mode on this device; HCMC Districts overlay on trips
// within 20 km of Ho Chi Minh City.

export type CityState = { state: 'loading' } | { state: 'ready'; city: City } | { state: 'missing'; query: string } | { state: 'error'; message: string }

const WORLD = { center: { lat: 20, lng: 0 }, zoom: 2 }
const HCMC_KM = 20

export default function TripMap({ city }: { city: CityState }) {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const districtsRef = useRef<Districts | null>(null)
  const [mapError, setMapError] = useState('')
  const [noKey, setNoKey] = useState(false)
  const [ready, setReady] = useState(false)
  const dark = useIsDark()
  const mode: Mode = dark ? 'dark' : 'light'
  const [picks, setPicks] = useState<Record<Mode, MapLook>>(() => ({ light: readLook('light'), dark: readLook('dark') }))
  const look = picks[mode]
  const [open, setOpen] = useState(false)
  const [showDistricts, setShowDistricts] = useState(false)

  const nearHcmc = city.state === 'ready' && distanceKm(city.city, HCMC_CENTRE) <= HCMC_KM

  // Create the map once.
  useEffect(() => {
    let cancelled = false
    loadGoogleMaps().then(
      g => {
        if (cancelled || !box.current) return
        if (!g) return setNoKey(true)
        mapRef.current = new g.maps.Map(box.current, {
          ...WORLD,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy'
        })
        setReady(true)
      },
      e => !cancelled && setMapError((e as Error).message)
    )
    return () => {
      cancelled = true
    }
  }, [])

  // Apply the current look.
  useEffect(() => {
    const m = mapRef.current
    if (!ready || !m) return
    m.setOptions({ mapTypeId: look.mapTypeId, styles: look.styles ?? null })
  }, [ready, look])

  // Fit the whole city when it's known (and whenever it changes).
  useEffect(() => {
    const m = mapRef.current
    if (!ready || !m || city.state !== 'ready') return
    const c = city.city
    if (c.north != null && c.south != null && c.east != null && c.west != null) {
      m.fitBounds({ north: c.north, south: c.south, east: c.east, west: c.west }, 0)
    } else {
      m.setCenter({ lat: c.lat, lng: c.lng })
      m.setZoom(12)
    }
  }, [ready, city])

  // Districts overlay.
  useEffect(() => {
    const m = mapRef.current
    if (!ready || !m) return
    const on = showDistricts && nearHcmc
    if (on && !districtsRef.current) districtsRef.current = new Districts(m)
    districtsRef.current?.setVisible(on, dark)
  }, [ready, showDistricts, nearHcmc, dark])

  function pick(l: MapLook | null) {
    saveLook(mode, l ? l.key : null)
    setPicks(p => ({ ...p, [mode]: l ?? MAP_LOOKS.find(x => x.key === DEFAULT_LOOK[mode])! }))
  }

  const notice =
    noKey ? "The map can't load in this build (no Google Maps key)."
    : mapError ? mapError
    : city.state === 'missing' ? `Couldn't find "${city.query}" on the map. Check the Destination in Edit trip.`
    : city.state === 'error' ? `Couldn't look up the city: ${city.message}`
    : ''

  const defaultName = MAP_LOOKS.find(x => x.key === DEFAULT_LOOK[mode])!.name

  return (
    <div className={styles.wrap}>
      <div ref={box} className={styles.map} role="region" aria-label="Map" />
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {ready && (
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.chip}
            aria-expanded={open}
            aria-controls="map-look-panel"
            onClick={() => setOpen(o => !o)}
          >
            <MapIcon /> Map look: {look.name}
          </button>
          {nearHcmc && (
            <button
              type="button"
              className={styles.chip}
              aria-pressed={showDistricts}
              onClick={() => setShowDistricts(s => !s)}
              title="Ho Chi Minh City district boundaries"
            >
              <LayersIcon /> Districts
            </button>
          )}
        </div>
      )}
      {ready && open && (
        <div id="map-look-panel" className={styles.panel} role="dialog" aria-label="Map look">
          <div className={styles.panelHead}>
            <strong>Map look</strong>
            <span>{dark ? 'Dark' : 'Light'} mode default: {defaultName}</span>
          </div>
          <div className={styles.tiles}>
            {MAP_LOOKS.map(l => (
              <button
                key={l.key}
                type="button"
                className={styles.tile}
                aria-pressed={l.key === look.key}
                onClick={() => pick(l)}
              >
                <Tile s={l.swatch} />
                <span className={styles.tileName}>{l.name}</span>
                <span className={styles.tileNote}>{l.key === DEFAULT_LOOK[mode] ? 'Default' : l.note}</span>
              </button>
            ))}
          </div>
          <div className={styles.panelFoot}>
            <span>Remembered on this device.</span>
            <button type="button" onClick={() => pick(null)}>Use the default</button>
          </div>
        </div>
      )}
    </div>
  )
}

/** A small colour sketch of a map look: land, a park, roads, a highway and a river. */
function Tile({ s }: { s: Swatch }) {
  return (
    <svg viewBox="0 0 120 78" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="120" height="78" fill={s.land} />
      <circle cx="30" cy="58" r="14" fill={s.park} />
      <circle cx="96" cy="16" r="9" fill={s.park} />
      <path d="M-5 30 L60 44 L125 36" stroke={s.road} strokeWidth="4" fill="none" />
      <path d="M40 -5 L52 40 L46 85" stroke={s.road} strokeWidth="3" fill="none" />
      <path d="M-5 70 L50 20 L125 -2" stroke={s.highway} strokeWidth="4" fill="none" />
      <path d="M78 -5 C70 20 92 40 80 60 C74 70 82 78 86 85" stroke={s.water} strokeWidth="9" fill="none" />
    </svg>
  )
}

function MapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  )
}

function LayersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  )
}

// ---- HCMC districts: dashed outlines and name pills (from Wanderlog's file) ----

type Ring = [number, number][]
interface DistrictFeature {
  properties: { name: string; center: [number, number] }
  geometry: { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] }
}

class Districts {
  private lines: google.maps.Polyline[] = []
  private labels: google.maps.OverlayView[] = []
  private loaded = false
  private wanted = false
  private dark = false

  constructor(private map: google.maps.Map) {
    fetch(`${import.meta.env.BASE_URL}hcm-districts.geojson`)
      .then(r => r.json())
      .then((data: { features: DistrictFeature[] }) => {
        for (const f of data.features) {
          const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
          for (const poly of polys) {
            const path = poly[0].map(([lng, lat]) => ({ lat, lng }))
            this.lines.push(new google.maps.Polyline({ path, clickable: false, strokeOpacity: 0, zIndex: 1 }))
          }
          this.labels.push(makeLabel(f.properties.name, { lat: f.properties.center[1], lng: f.properties.center[0] }))
        }
        this.loaded = true
        this.apply()
      })
      .catch(() => undefined)
  }

  setVisible(on: boolean, dark: boolean) {
    this.wanted = on
    this.dark = dark
    this.apply()
  }

  private apply() {
    if (!this.loaded) return
    const colour = this.dark ? '#E0716A' : '#9E2A2B'
    const dash = { path: 'M 0,-1 0,1', strokeOpacity: 0.85, strokeColor: colour, strokeWeight: 2, scale: 3 }
    for (const l of this.lines) {
      l.setOptions({ icons: [{ icon: dash, offset: '0', repeat: '12px' }] })
      l.setMap(this.wanted ? this.map : null)
    }
    for (const lab of this.labels) lab.setMap(this.wanted ? this.map : null)
  }
}

function makeLabel(text: string, at: google.maps.LatLngLiteral): google.maps.OverlayView {
  class Label extends google.maps.OverlayView {
    private el: HTMLDivElement | null = null
    onAdd() {
      this.el = document.createElement('div')
      this.el.className = styles.districtPill
      this.el.textContent = text
      this.getPanes()?.overlayLayer.appendChild(this.el)
    }
    draw() {
      const p = this.getProjection()?.fromLatLngToDivPixel(new google.maps.LatLng(at))
      if (p && this.el) {
        this.el.style.left = `${p.x}px`
        this.el.style.top = `${p.y}px`
      }
    }
    onRemove() {
      this.el?.remove()
      this.el = null
    }
  }
  return new Label()
}
