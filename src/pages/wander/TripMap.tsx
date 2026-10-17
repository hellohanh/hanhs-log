import { centreFor } from '../../lib/mapCentre'
import { createPortal } from 'react-dom'
import { useMapPopup } from './mapPopup'
import { useEffect, useMemo, useRef, useState } from 'react'
import { loadGoogleMaps } from '../../lib/googleMaps'
import { MAP_LOOKS, canHidePins, lookOptions, mapKind, readLook, readPins, saveLook, savePins, DEFAULT_LOOK, type MapLook, type Mode, type Swatch } from '../../lib/mapStyles'
import { type City } from '../../lib/city'
import { anyDistrictInView } from '../../lib/districts'
import { type Bounds } from '../../lib/countryBounds'
import { MODE_COLOR, type RouteSeg } from '../../lib/directions'
import { useIsDark } from '../../lib/theme'
import CameraControl from './CameraControl'
import MapCheck from '../../components/MapCheck'
import GPinsIcon from '../../components/GPinsIcon'
import { glideTo } from '../../lib/glide'
import { makePinLayer, type MapPin, type PinLayer } from './mapPinLayer'
import styles from './TripMap.module.css'

export type { MapPin } from './mapPinLayer'

// The trip map (M3 step 3, approved mockup v2, session 4): opens on the
// trip's Primary City centre at zoom 13, no pins yet (old Wanderlog pins
// appear only after Hanh sorts them). Map look switcher with 11 looks and a
// Pins / No pins chip for Google's place pins (remembered on this device),
// remembered per mode on this device; HCMC Districts chip whenever any
// HCMC district is in view. Our own camera control (3 × 4) with
// tilt, rotate and reset: Google's own looks run on the tilt-capable map
// (our Map ID); hand-made looks need the flat map, where tilt and rotate
// are greyed out (Hanh, session 4).

export type CityState = { state: 'loading' } | { state: 'ready'; city: City } | { state: 'missing'; query: string } | { state: 'error'; message: string }

/** A day's city on the map (E102). */
export interface DayCity {
  name: string
  lat: number
  lng: number
}

const WORLD = { center: { lat: 20, lng: 0 }, zoom: 2 }
const OPENING_ZOOM = 13

export default function TripMap({
  city,
  rightInset = 0,
  pins: tripPins = [],
  route,
  onPinClick,
  focus,
  popup,
  popupAt,
  onPopupClose,
  phone = false,
  routeOn,
  onRouteToggle,
  onMapClick,
  openLook = 0,
  onView,
  dayCity,
  onDayCity
}: {
  city: CityState
  rightInset?: number
  pins?: MapPin[]
  /** The day route to draw, coloured per mode, or null/undefined when off. */
  route?: RouteSeg[] | null
  onPinClick?: (id: string) => void
  /** Pan here (a new object each time, so the same place can be re-focused). */
  focus?: { lat: number; lng: number; dy?: number } | null
  /** The pin popup (session 10): what to show, and the pin it hangs from. */
  popup?: React.ReactNode
  popupAt?: { lat: number; lng: number } | null
  onPopupClose?: () => void
  /**
   * Phone layout (session 10, approved): three round buttons on the right —
   * Map look (with GPins and Districts inside its panel), My location, Day
   * route — instead of the chips and the camera control.
   */
  phone?: boolean
  routeOn?: boolean
  onRouteToggle?: () => void
  /** A tap on the map itself (not a pin). */
  onMapClick?: () => void
  /** Bumped by the phone's ⋯ menu to open the Map look panel. */
  openLook?: number
  /** The visible map area after each move (session 13: Nom-Nom follows the map). */
  onView?: (b: Bounds) => void
  /** The open day's city (session 13, E102): Reset goes here instead of the Primary City. */
  dayCity?: DayCity | null
  /** The home_pin button: work the day's city out afresh, then glide there. */
  onDayCity?: () => Promise<DayCity | null>
}) {
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

  // The Districts chip shows only while any HCMC district is in view, on any
  // trip; it disappears once none are (Hanh, session 4).
  const [districtsInView, setDistrictsInView] = useState(false)
  const home = city.state === 'ready' ? { center: { lat: city.city.lat, lng: city.city.lng }, zoom: OPENING_ZOOM } : WORLD
  // Reset (camera control) goes to the open day's city when there is one (E102).
  const resetView = dayCity ? { center: { lat: dayCity.lat, lng: dayCity.lng }, zoom: OPENING_ZOOM } : home
  const goDayCity = async () => {
    if (!map) return
    const c = (await onDayCity?.()) ?? dayCity
    if (!c) return
    glideTo(map, { center: centreFor({ lat: c.lat, lng: c.lng }, OPENING_ZOOM, insetRef.current / 2), zoom: OPENING_ZOOM })
  }
  const mapId = import.meta.env.VITE_GOOGLE_MAP_ID
  const [pins, setPins] = useState(readPins)
  const noPinsId = import.meta.env.VITE_GOOGLE_MAP_ID_NOPINS
  const opts = useMemo(() => lookOptions(look, pins, Boolean(noPinsId)), [look, pins, noPinsId])
  const pinsLocked = !canHidePins(look, Boolean(noPinsId))
  const { kind, mapId: activeMapId } = mapKind(look, opts, { base: mapId, noPins: noPinsId })
  const tiltable = kind !== 'flat'

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
        // Each map gets its own fresh holder; the old map's holder is removed
        // and its listeners cleared, so switching looks doesn't pile up
        // invisible Google maps (and their WebGL memory) in the page (session 9).
        const holder = document.createElement('div')
        holder.style.cssText = 'position:absolute;inset:0'
        box.current.appendChild(holder)
        const m = new g.maps.Map(holder, {
          ...view,
          ...(kind === 'flat'
            ? { renderingType: g.maps.RenderingType.RASTER }
            : {
                mapId: activeMapId,
                renderingType: g.maps.RenderingType.VECTOR,
                colorScheme: kind.startsWith('tilt-dark') ? g.maps.ColorScheme.DARK : g.maps.ColorScheme.LIGHT,
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
        if (prev) {
          g.maps.event.clearInstanceListeners(prev)
          prev.getDiv().remove()
        }
        mapRef.current = m
        setMap(m)
      },
      e => !cancelled && setMapError((e as Error).message)
    )
    return () => {
      cancelled = true
    }
  }, [kind, activeMapId])

  // Apply the current look (hand-made colours only work on the flat map).
  useEffect(() => {
    if (!map) return
    map.setOptions(kind === 'flat' ? { mapTypeId: opts.mapTypeId, styles: opts.styles } : { mapTypeId: opts.mapTypeId })
  }, [map, kind, opts.mapTypeId, opts.styles])

  // Open on the Primary City's centre at zoom 13 (Hanh, session 4), once per
  // city. Google's city outlines don't work for this: HCMC's covers half of
  // southern Vietnam since the 2025 merger, while Paris's is tiny.
  useEffect(() => {
    if (!map || city.state !== 'ready' || appliedCity.current === city.city) return
    appliedCity.current = city.city
    map.setZoom(OPENING_ZOOM)
    map.setCenter(centreFor({ lat: city.city.lat, lng: city.city.lng }, OPENING_ZOOM, rightInset / 2))
  }, [map, city])

  // The trip's own pins (rebuilt with the map when the map is replaced).
  const pinLayer = useRef<PinLayer | null>(null)
  const clickRef = useRef(onPinClick)
  clickRef.current = onPinClick
  useEffect(() => {
    if (!map) return
    const layer = makePinLayer(id => clickRef.current?.(id), styles.tripPin)
    layer.setMap(map)
    pinLayer.current = layer
    return () => {
      layer.setMap(null)
      pinLayer.current = null
    }
  }, [map])
  useEffect(() => {
    pinLayer.current?.setPins(tripPins)
  }, [map, tripPins])
  useEffect(() => {
    if (!map || !focus) return
    // Session 11: glide there (street level at least) instead of jumping.
    const zoom = Math.max(map.getZoom() ?? 15, 15)
    glideTo(map, { center: centreFor(focus, zoom, insetRef.current / 2, focus.dy ?? 0), zoom })
  }, [map, focus])

  // Opening or closing the itinerary panel shifts the map with it, so what
  // was in the middle of the visible part stays there (session 10).
  const insetRef = useRef(rightInset)
  useEffect(() => {
    if (map && rightInset !== insetRef.current) map.panBy((rightInset - insetRef.current) / 2, 0)
    insetRef.current = rightInset
  }, [map, rightInset])

  // The day route (session 6): one polyline per leg, coloured by travel mode;
  // an unset leg is a straight dashed grey line. Rebuilt with the map.
  const routeLines = useRef<google.maps.Polyline[]>([])
  useEffect(() => {
    if (!map) return
    for (const l of routeLines.current) l.setMap(null)
    routeLines.current = []
    for (const seg of route ?? []) {
      const set = seg.mode && seg.path && seg.path.length > 1
      const line = new google.maps.Polyline({
        map,
        path: set ? seg.path! : [seg.from, seg.to],
        geodesic: !set,
        strokeColor: set ? MODE_COLOR[seg.mode!] : '#8A8780',
        strokeWeight: set ? 5 : 3,
        strokeOpacity: set ? 0.9 : 0,
        icons: set
          ? undefined
          : [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.9, strokeColor: '#8A8780', scale: 3 }, offset: '0', repeat: '12px' }],
        zIndex: 1
      })
      routeLines.current.push(line)
    }
    return () => {
      for (const l of routeLines.current) l.setMap(null)
      routeLines.current = []
    }
  }, [map, route])

  // Watch the view: is any HCMC district on screen? And tell the page what's
  // on screen, so the Nom-Nom list follows the map (session 13).
  const onViewRef = useRef(onView)
  onViewRef.current = onView
  useEffect(() => {
    if (!map) return
    const check = () => {
      const b = map.getBounds()
      if (!b) return
      const ne = b.getNorthEast()
      const sw = b.getSouthWest()
      const view = { north: ne.lat(), south: sw.lat(), east: ne.lng(), west: sw.lng() }
      setDistrictsInView(anyDistrictInView(view))
      onViewRef.current?.(view)
    }
    const l = map.addListener('idle', check)
    check()
    return () => l.remove()
  }, [map])

  // Districts overlay (rebuilt with the map when the map is replaced).
  useEffect(() => {
    if (!map) return
    const on = showDistricts && districtsInView
    if (on && !districtsRef.current) districtsRef.current = new Districts(map)
    districtsRef.current?.setVisible(on)
  }, [map, showDistricts, districtsInView])

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

  useEffect(() => { if (openLook) setOpen(true) }, [openLook])

  // A tap on the map (not a pin): the phone drops its sheet and closes a card.
  const mapClickRef = useRef(onMapClick)
  mapClickRef.current = onMapClick
  useEffect(() => {
    if (!map) return
    const l = map.addListener('click', () => mapClickRef.current?.())
    return () => l.remove()
  }, [map])

  // My location (phone, session 10): a blue dot, and the map centres on it.
  const [locating, setLocating] = useState('')
  const meDot = useRef<google.maps.Circle | null>(null)
  const locate = () => {
    if (!map || !navigator.geolocation) return setLocating("Your phone didn't share its location.")
    setLocating('Finding you…')
    navigator.geolocation.getCurrentPosition(
      p => {
        const at = { lat: p.coords.latitude, lng: p.coords.longitude }
        meDot.current?.setMap(null)
        meDot.current = new google.maps.Circle({ map, center: at, radius: Math.max(12, p.coords.accuracy / 4), fillColor: '#1A8CFF', fillOpacity: 0.9, strokeColor: '#FFFFFF', strokeWeight: 3, clickable: false, zIndex: 9 })
        map.panTo(at)
        if ((map.getZoom() ?? 0) < 15) map.setZoom(15)
        setLocating('')
      },
      () => setLocating("Couldn't get your location. Check the browser's location permission."),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }
  useEffect(() => () => { meDot.current?.setMap(null) }, [])

  // The pin popup (session 10).
  const popupEl = useMapPopup(map, popup ? popupAt ?? null : null, () => onPopupClose?.(), rightInset)

  return (
    <div className={styles.wrap}>
      {popupEl && popup ? createPortal(popup, popupEl) : null}
      <div ref={box} className={styles.map} role="region" aria-label="Map" />
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {map && !phone && <CameraControl map={map} home={resetView} tiltable={tiltable} right={rightInset + 16} inset={rightInset} />}
      {ready && phone && (
        <div className={styles.phoneCtl}>
          <button type="button" className={styles.chip} aria-expanded={open} aria-controls="map-look-panel" aria-label={`Map look: ${look.name}`} onClick={() => setOpen(o => !o)}>
            <MapIcon />
          </button>
          <button type="button" className={styles.chip} aria-label="My location" onClick={locate}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
          </button>
          {onRouteToggle && (
            <button type="button" className={`${styles.chip} ${routeOn ? styles.chipOn : ''}`} aria-pressed={!!routeOn} aria-label="Day route" onClick={onRouteToggle}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h7a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h7" /></svg>
            </button>
          )}
          {/* Session 13 (E102 on phones): the day's city, under Day route. */}
          {dayCity && (
            <button type="button" className={styles.chip} onClick={goDayCity} aria-label={`Go to this day's city: ${dayCity.name}`} title={`Go to this day's city: ${dayCity.name}`}>
              <HomePinIcon />
            </button>
          )}
        </div>
      )}
      {locating && <p className={styles.notice} role="status">{locating}</p>}
      {ready && !phone && (
        <div className={styles.controls}>
          <button
            ref={lookBtnRef}
            type="button"
            className={styles.chip}
            aria-expanded={open}
            aria-controls="map-look-panel"
            aria-label={`Map look: ${look.name}`}
            title={`Map look: ${look.name}`}
            onClick={() => setOpen(o => !o)}
          >
            <MapIcon />
          </button>
          <button
            type="button"
            className={`${styles.chip} ${pinsLocked ? styles.chipOff : ''}`}
            aria-pressed={pinsLocked ? true : pins}
            aria-disabled={pinsLocked || undefined}
            aria-label={pinsLocked ? "GPins ON: Google's place pins can't be hidden on Google dark yet" : pins ? "GPins ON: showing Google's place pins. Click to hide them" : "GPins OFF: Google's place pins hidden. Click to show them"}
            title={pinsLocked ? "Google's place pins can't be hidden on Google dark yet" : pins ? "Hide Google's place pins (shops, restaurants, landmarks)" : "Show Google's place pins"}
            onClick={() => {
              if (pinsLocked) return
              savePins(!pins)
              setPins(!pins)
            }}
          >
            <GPinsIcon off={!(pinsLocked || pins)} />
          </button>
          {dayCity && (
            <button
              type="button"
              className={styles.chip}
              onClick={goDayCity}
              aria-label={`Go to this day's city: ${dayCity.name}`}
              title={`Go to this day's city: ${dayCity.name}`}
            >
              <HomePinIcon />
            </button>
          )}
          {districtsInView && (
            <button
              type="button"
              className={styles.chip}
              aria-pressed={showDistricts}
              onClick={() => setShowDistricts(s => !s)}
              aria-label="Districts: Ho Chi Minh City district boundaries"
              title="Districts: Ho Chi Minh City district boundaries"
            >
              <LayersIcon />
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
          {phone && (
            <div className={styles.phoneRow}>
              <button
                type="button"
                className={`${styles.chip} ${pinsLocked ? styles.chipOff : ''}`}
                aria-pressed={pinsLocked ? true : pins}
                aria-disabled={pinsLocked || undefined}
                aria-label={pinsLocked || pins ? 'GPins ON' : 'GPins OFF'}
                title={pinsLocked || pins ? "GPins ON: Google's place pins showing" : "GPins OFF: Google's place pins hidden"}
                onClick={() => {
                  if (pinsLocked) return
                  savePins(!pins)
                  setPins(!pins)
                }}
              >
                <GPinsIcon off={!(pinsLocked || pins)} />
              </button>
              {districtsInView && (
                <button type="button" className={`${styles.chip} ${styles.chipText}`} aria-pressed={showDistricts} onClick={() => setShowDistricts(s => !s)}>
                  Districts
                </button>
              )}
            </div>
          )}
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
          <MapCheck
            className={styles.check}
            env={() => {
              if (!map) return null
              const before = { look, pins: pins, center: map.getCenter()!.toJSON(), zoom: map.getZoom() ?? home.zoom }
              return {
                ids: { base: mapId, noPins: noPinsId },
                home,
                getMap: () => mapRef.current,
                apply: (key, on) => {
                  setPicks(p => ({ ...p, [mode]: MAP_LOOKS.find(l => l.key === key)! }))
                  setPins(on)
                },
                restore: () => {
                  setPicks(p => ({ ...p, [mode]: before.look }))
                  setPins(before.pins)
                  setTimeout(() => {
                    mapRef.current?.setCenter(before.center)
                    mapRef.current?.setZoom(before.zoom)
                  }, 900)
                }
              }
            }}
          />
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

/** Material Symbols "home_pin" (Outlined 400, Apache 2.0, Google), Hanh's pick (session 13). */
function HomePinIcon() {
  return (
    <svg width="22" height="22" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
      <path d="M360-440h80v-110h80v110h80v-190l-120-80-120 80v190Zm120 254q122-112 181-203.5T720-552q0-109-69.5-178.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186Zm0 106Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 100-79.5 217.5T480-80Zm0-480Z" />
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
