import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '../../lib/googleMaps'
import { MAP_LOOKS, canTilt, readLook, saveLook, DEFAULT_LOOK, type MapLook, type Mode, type Swatch } from '../../lib/mapStyles'
import { distanceKm, HCMC_CENTRE, type City } from '../../lib/city'
import { useIsDark } from '../../lib/theme'
import CameraControl from './CameraControl'
import styles from './TripMap.module.css'

// The trip map (M3 step 3, approved mockup v2, session 4): opens on the
// trip's Primary City centre at zoom 13, no pins yet (old Wanderlog pins
// appear only after Hanh sorts them). Map look switcher with 12 looks,
// remembered per mode on this device; HCMC Districts overlay on trips
// within 20 km of Ho Chi Minh City. Our own camera control (3 × 4) with
// tilt, rotate and reset: Google's own looks run on the tilt-capable map
// (our Map ID); hand-made looks need the flat map, where tilt and rotate
// are greyed out (Hanh, session 4).

export type CityState = { state: 'loading' } | { state: 'ready'; city: City } | { state: 'missing'; query: string } | { state: 'error'; message: string }

const WORLD = { center: { lat: 20, lng: 0 }, zoom: 2 }
const HCMC_KM = 20
const OPENING_ZOOM = 13

export default function TripMap({ city }: { city: CityState }) {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const districtsRef = useRef<Districts | null>(null)
  const appliedCity = useRef<City | null>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [mapError, setMapError] = useState('')
  const [noKey, setNoKey] = useState(false)
  const ready = map !== null
  const dark = useIsDark()
  const mode: Mode = dark ? 'dark' : 'light'
  const [picks, setPicks] = useState<Record<Mode, MapLook>>(() => ({ light: readLook('light'), dark: readLook('dark') }))
  const look = picks[mode]
  const [open, setOpen] = useState(false)
  const [showDistricts, setShowDistricts] = useState(false)

  const nearHcmc = city.state === 'ready' && distanceKm(city.city, HCMC_CENTRE) <= HCMC_KM
  const home = city.state === 'ready' ? { center: { lat: city.city.lat, lng: city.city.lng }, zoom: OPENING_ZOOM } : WORLD
  const mapId = import.meta.env.VITE_GOOGLE_MAP_ID
  const tiltable = Boolean(mapId) && canTilt(look)
  // Which kind of map this look needs. A map's ID, rendering and colour
  // scheme can't change after it's made, so a new kind means a new map.
  const kind = tiltable ? (look.dark ? 'tilt-dark' : 'tilt') : 'flat'

  // Create the map, and again whenever the kind changes (keeping the view).
  useEffect(() => {
    let cancelled = false
    loadGoogleMaps().then(
      g => {
        if (cancelled || !box.current) return
        if (!g) return setNoKey(true)
        const prev = mapRef.current
        const view = prev ? { center: prev.getCenter()!.toJSON(), zoom: prev.getZoom() ?? OPENING_ZOOM } : WORLD
        districtsRef.current?.setVisible(false)
        districtsRef.current = null
        const m = new g.maps.Map(box.current, {
          ...view,
          ...(kind === 'flat'
            ? { renderingType: g.maps.RenderingType.RASTER }
            : {
                mapId,
                renderingType: g.maps.RenderingType.VECTOR,
                colorScheme: kind === 'tilt-dark' ? g.maps.ColorScheme.DARK : g.maps.ColorScheme.LIGHT,
                tiltInteractionEnabled: true,
                headingInteractionEnabled: true
              }),
          zoomControl: false,
          cameraControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy'
        })
        mapRef.current = m
        setMap(m)
      },
      e => !cancelled && setMapError((e as Error).message)
    )
    return () => {
      cancelled = true
    }
  }, [kind, mapId])

  // Apply the current look (hand-made colours only work on the flat map).
  useEffect(() => {
    if (!map) return
    map.setOptions(kind === 'flat' ? { mapTypeId: look.mapTypeId, styles: look.styles ?? null } : { mapTypeId: look.mapTypeId })
  }, [map, look, kind])

  // Open on the Primary City's centre at zoom 13 (Hanh, session 4), once per
  // city. Google's city outlines don't work for this: HCMC's covers half of
  // southern Vietnam since the 2025 merger, while Paris's is tiny.
  useEffect(() => {
    if (!map || city.state !== 'ready' || appliedCity.current === city.city) return
    appliedCity.current = city.city
    map.setCenter({ lat: city.city.lat, lng: city.city.lng })
    map.setZoom(OPENING_ZOOM)
  }, [map, city])

  // Districts overlay (rebuilt with the map when the map is replaced).
  useEffect(() => {
    if (!map) return
    const on = showDistricts && nearHcmc
    if (on && !districtsRef.current) districtsRef.current = new Districts(map)
    districtsRef.current?.setVisible(on)
  }, [map, showDistricts, nearHcmc])

  function pick(l: MapLook | null) {
    saveLook(mode, l ? l.key : null)
    setPicks(p => ({ ...p, [mode]: l ?? MAP_LOOKS.find(x => x.key === DEFAULT_LOOK[mode])! }))
    setOpen(false) // picking a look closes the panel (Hanh, session 4)
  }

  // The panel also closes with Escape or a click anywhere outside it.
  const panelRef = useRef<HTMLDivElement>(null)
  const lookBtnRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!panelRef.current?.contains(t) && !lookBtnRef.current?.contains(t)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  const notice =
    noKey ? "The map can't load in this build (no Google Maps key)."
    : mapError ? mapError
    : city.state === 'missing' ? `Couldn't find "${city.query}" on the map. Check the Primary City and Country in Edit trip.`
    : city.state === 'error' ? `Couldn't look up the city: ${city.message}`
    : ''

  const defaultName = MAP_LOOKS.find(x => x.key === DEFAULT_LOOK[mode])!.name

  return (
    <div className={styles.wrap}>
      <div ref={box} className={styles.map} role="region" aria-label="Map" />
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {map && <CameraControl map={map} home={home} tiltable={tiltable} />}
      {ready && (
        <div className={styles.controls}>
          <button
            ref={lookBtnRef}
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
        <div ref={panelRef} id="map-look-panel" className={styles.panel} role="dialog" aria-label="Map look">
          <div className={styles.panelHead}>
            <strong>Map look</strong>
            <span>{dark ? 'Dark' : 'Light'} mode default: {defaultName}</span>
            <button type="button" className={styles.close} aria-label="Close" onClick={() => setOpen(false)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
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

// ---- HCMC districts: the old Wanderlog overlay (Hanh, session 4) ----
// Each of the 22 districts is filled in its own colour at 20% with a solid
// outline in a darker shade of it, and named in a dark-red pill. Colours
// step round the colour wheel by the golden angle (~137.5°) in the file's
// order, so neighbouring districts never get similar shades; the same order
// and formula as the old Wanderlog give the same colour for each district.

function districtColours(i: number) {
  const hue = Math.round((i * 137.508) % 360)
  return { fill: `hsl(${hue}, 65%, 55%)`, stroke: `hsl(${hue}, 65%, 40%)` }
}

class Districts {
  private layer: google.maps.Data
  private labels: google.maps.OverlayView[] = []
  private loaded = false
  private wanted = false

  constructor(private map: google.maps.Map) {
    this.layer = new google.maps.Data()
    this.layer.loadGeoJson(`${import.meta.env.BASE_URL}hcm-districts.geojson`, {}, features => {
      features.forEach((f, i) => {
        const c = districtColours(i)
        this.layer.overrideStyle(f, { fillColor: c.fill, fillOpacity: 0.2, strokeColor: c.stroke, strokeWeight: 1.5, clickable: false })
        const name = f.getProperty('name') as string | undefined
        const center = f.getProperty('center') as [number, number] | undefined
        if (name && center) this.labels.push(makeLabel(name.toUpperCase(), { lat: center[1], lng: center[0] }))
      })
      this.loaded = true
      this.apply()
    })
  }

  setVisible(on: boolean) {
    this.wanted = on
    this.apply()
  }

  private apply() {
    this.layer.setMap(this.wanted ? this.map : null)
    if (!this.loaded) return
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
