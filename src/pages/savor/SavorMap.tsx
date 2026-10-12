import { useEffect, useMemo, useRef, useState } from 'react'
import { loadGoogleMaps } from '../../lib/googleMaps'
import { MAP_LOOKS, canHidePins, lookOptions, readLook, readPins, saveLook, savePins, DEFAULT_LOOK, type MapLook, type Mode, type Swatch } from '../../lib/mapStyles'
import { useIsDark } from '../../lib/theme'
import CameraControl from '../wander/CameraControl'
import { makePinLayer, type MapPin, type PinLayer } from '../wander/mapPinLayer'
import type { Bounds } from '../../lib/countryBounds'
import styles from '../wander/TripMap.module.css'

// The Savorlog map (M4 step 4c): the chosen place's eateries on one map,
// reusing the trip map's looks (11), Pins toggle and 3 × 4 camera control.
// The location gate (E66) frames a country to its mainland box, or a city at
// zoom 13 on its centre.

const WORLD = { center: { lat: 20, lng: 0 }, zoom: 2 }

/** Where the map should sit: a country's box, or a city centre at a zoom. */
export interface Frame {
  bounds?: Bounds
  center?: { lat: number; lng: number }
  zoom?: number
}

export default function SavorMap({
  pins,
  frame,
  onPinClick
}: {
  pins: MapPin[]
  frame?: Frame | null
  onPinClick?: (id: string) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [mapError, setMapError] = useState('')
  const [noKey, setNoKey] = useState(false)
  const ready = map !== null
  const dark = useIsDark()
  const mode: Mode = dark ? 'dark' : 'light'
  const [picks, setPicks] = useState<Record<Mode, MapLook>>(() => ({ light: readLook('light'), dark: readLook('dark') }))
  const look = picks[mode]
  const [open, setOpen] = useState(false)
  const mapId = import.meta.env.VITE_GOOGLE_MAP_ID
  const [showPins, setShowPins] = useState(readPins)
  const opts = useMemo(() => lookOptions(look, showPins), [look, showPins])
  const pinsLocked = !canHidePins(look)
  const tiltable = Boolean(mapId) && opts.tiltable
  const kind = tiltable ? (look.dark ? 'tilt-dark' : 'tilt') : 'flat'

  // The camera control's Reset returns to the chosen place's centre.
  const home = useMemo(
    () => (frame?.center ? { center: frame.center, zoom: frame.zoom ?? 5 } : WORLD),
    [frame]
  )

  // Create the map, and again whenever the kind changes (keeping the view).
  useEffect(() => {
    let cancelled = false
    loadGoogleMaps().then(
      g => {
        if (cancelled || !box.current) return
        if (!g) return setNoKey(true)
        const prev = mapRef.current
        const view = prev ? { center: prev.getCenter()!.toJSON(), zoom: prev.getZoom() ?? WORLD.zoom } : WORLD
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
    map.setOptions(kind === 'flat' ? { mapTypeId: opts.mapTypeId, styles: opts.styles } : { mapTypeId: opts.mapTypeId })
  }, [map, kind, opts.mapTypeId, opts.styles])

  // Frame the chosen place: a country to its mainland box, a city at its zoom.
  useEffect(() => {
    if (!map || !frame) return
    if (frame.bounds) {
      const b = frame.bounds
      map.fitBounds({ south: b.south, west: b.west, north: b.north, east: b.east }, 24)
    } else if (frame.center) {
      map.setCenter(frame.center)
      map.setZoom(frame.zoom ?? 13)
    }
  }, [map, frame])

  // The eatery pins (rebuilt with the map when the map is replaced).
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
    pinLayer.current?.setPins(pins)
  }, [map, pins])

  function pick(l: MapLook | null) {
    saveLook(mode, l ? l.key : null)
    setPicks(p => ({ ...p, [mode]: l ?? MAP_LOOKS.find(x => x.key === DEFAULT_LOOK[mode])! }))
    setOpen(false)
  }

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

  const notice = noKey ? "The map can't load in this build (no Google Maps key)." : mapError
  const defaultName = MAP_LOOKS.find(x => x.key === DEFAULT_LOOK[mode])!.name

  return (
    <div className={styles.wrap}>
      <div ref={box} className={styles.map} role="region" aria-label="Map" />
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {map && <CameraControl map={map} home={home} tiltable={tiltable} right={16} />}
      {ready && (
        <div className={styles.controls}>
          <button
            ref={lookBtnRef}
            type="button"
            className={styles.chip}
            aria-expanded={open}
            aria-controls="savor-look-panel"
            aria-label={`Map look: ${look.name}`}
            title={`Map look: ${look.name}`}
            onClick={() => setOpen(o => !o)}
          >
            <MapIcon />
          </button>
          <button
            type="button"
            className={`${styles.chip} ${pinsLocked ? styles.chipOff : ''}`}
            aria-pressed={pinsLocked ? true : showPins}
            aria-disabled={pinsLocked || undefined}
            aria-label={pinsLocked ? "Pins: Google's place pins can't be hidden on Google dark" : showPins ? "Pins: showing Google's place pins. Click to hide them" : "No pins: Google's place pins hidden. Click to show them"}
            title={pinsLocked ? "Pins can't be hidden on Google dark" : showPins ? "Pins: hide Google's place pins" : 'No pins: show them'}
            onClick={() => {
              if (pinsLocked) return
              savePins(!showPins)
              setShowPins(!showPins)
            }}
          >
            <PinIcon off={!showPins && !pinsLocked} />
          </button>
        </div>
      )}
      {ready && open && (
        <div ref={panelRef} id="savor-look-panel" className={styles.panel} role="dialog" aria-label="Map look">
          <div className={styles.panelHead}>
            <strong>Map look</strong>
            <span>{dark ? 'Dark' : 'Light'} mode default: {defaultName}</span>
            <button type="button" className={styles.close} aria-label="Close" onClick={() => setOpen(false)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <div className={styles.tiles}>
            {MAP_LOOKS.map(l => (
              <button key={l.key} type="button" className={styles.tile} aria-pressed={l.key === look.key} onClick={() => pick(l)}>
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
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14M15 6v14" />
    </svg>
  )
}
function PinIcon({ off }: { off?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10Z" /><circle cx="12" cy="11" r="2" />{off && <path d="M4 4l16 16" />}
    </svg>
  )
}
