import { createPortal } from 'react-dom'
import { useMapPopup } from '../wander/mapPopup'
import { useEffect, useMemo, useRef, useState } from 'react'
import { loadGoogleMaps } from '../../lib/googleMaps'
import { MAP_LOOKS, canHidePins, lookOptions, mapKind, readLook, readPins, saveLook, savePins, DEFAULT_LOOK, type MapLook, type Mode, type Swatch } from '../../lib/mapStyles'
import { useIsDark } from '../../lib/theme'
import CameraControl from '../wander/CameraControl'
import MapCheck from '../../components/MapCheck'
import { glideTo } from '../../lib/glide'
import { makePinLayer, type MapPin, type PinLayer } from '../wander/mapPinLayer'
import type { Bounds } from '../../lib/countryBounds'
import styles from '../wander/TripMap.module.css'

// The Savorlog map (M4 step 4c): the chosen place's eateries on one map,
// reusing the trip map's looks (11), Pins toggle and 3 × 4 camera control.
// Picking a place (the popup or the City/Country field) glides to a country's
// mainland box or a city at zoom 13; the pins and list always follow the map
// (session 11).

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
  onPinClick,
  onView,
  focus,
  popup,
  popupAt,
  onPopupClose
}: {
  pins: MapPin[]
  frame?: Frame | null
  onPinClick?: (id: string) => void
  /** The visible area after each pan or zoom (session 10: the list follows the map). */
  onView?: (b: Bounds) => void
  /** Pan here (a new object each time). */
  focus?: { lat: number; lng: number } | null
  /** The pin popup (session 10): what to show, and the pin it hangs from. */
  popup?: React.ReactNode
  popupAt?: { lat: number; lng: number } | null
  onPopupClose?: () => void
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
  const noPinsId = import.meta.env.VITE_GOOGLE_MAP_ID_NOPINS
  const opts = useMemo(() => lookOptions(look, showPins, Boolean(noPinsId)), [look, showPins, noPinsId])
  const pinsLocked = !canHidePins(look, Boolean(noPinsId))
  const { kind, mapId: activeMapId } = mapKind(look, opts, { base: mapId, noPins: noPinsId })
  const tiltable = kind !== 'flat'

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

  // Tell the page what's in view once the map settles after a pan or zoom.
  const onViewRef = useRef(onView)
  onViewRef.current = onView
  useEffect(() => {
    if (!map) return
    const l = map.addListener('idle', () => {
      const b = map.getBounds()?.toJSON()
      if (b) onViewRef.current?.(b)
    })
    return () => l.remove()
  }, [map])

  // Frame the chosen place: a country to its mainland box, a city at its zoom.
  useEffect(() => {
    if (!map || !frame) return
    // Session 11: glide there; the pins and list then follow the map.
    if (frame.bounds) glideTo(map, { bounds: frame.bounds, pad: 24 })
    else if (frame.center) glideTo(map, { center: frame.center, zoom: frame.zoom ?? 13 })
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

  // The pin popup (session 10).
  const popupEl = useMapPopup(map, popup ? popupAt ?? null : null, () => onPopupClose?.())
  useEffect(() => {
    if (!map || !focus) return
    glideTo(map, { center: focus, zoom: Math.max(map.getZoom() ?? 15, 15) })
  }, [map, focus])

  return (
    <div className={styles.wrap}>
      {popupEl && popup ? createPortal(popup, popupEl) : null}
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
            className={`${styles.chip} ${styles.chipText} ${pinsLocked ? styles.chipOff : ''}`}
            aria-pressed={pinsLocked ? true : showPins}
            aria-disabled={pinsLocked || undefined}
            aria-label={pinsLocked ? "GPins ON: Google's place pins can't be hidden on Google dark yet" : showPins ? "GPins ON: showing Google's place pins. Click to hide them" : "GPins OFF: Google's place pins hidden. Click to show them"}
            title={pinsLocked ? "Google's place pins can't be hidden on Google dark yet" : showPins ? "Hide Google's place pins (shops, restaurants, landmarks)" : "Show Google's place pins"}
            onClick={() => {
              if (pinsLocked) return
              savePins(!showPins)
              setShowPins(!showPins)
            }}
          >
            {pinsLocked || showPins ? 'GPins ON' : 'GPins OFF'}
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
          <MapCheck
            className={styles.check}
            env={() => {
              if (!map) return null
              const before = { look, pins: showPins, center: map.getCenter()!.toJSON(), zoom: map.getZoom() ?? home.zoom }
              return {
                ids: { base: mapId, noPins: noPinsId },
                home,
                getMap: () => mapRef.current,
                apply: (key, on) => {
                  setPicks(p => ({ ...p, [mode]: MAP_LOOKS.find(l => l.key === key)! }))
                  setShowPins(on)
                },
                restore: () => {
                  setPicks(p => ({ ...p, [mode]: before.look }))
                  setShowPins(before.pins)
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
