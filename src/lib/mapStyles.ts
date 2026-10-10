/// <reference types="google.maps" />
// Map looks for the trip map's Map look switcher (M3 step 3). "Paper" is
// Hanh's Log's own muted style (E4 palette); the others are Google's presets
// from its Styling Wizard plus Google's built-in map types.

type Style = google.maps.MapTypeStyle[]

export const PAPER: Style = [
  { elementType: 'geometry', stylers: [{ color: '#f1eadb' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#7a7064' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f6efe2' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#d9cfbd' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#e9e1d0' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#dce3c8' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6d7a55' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e2d8c6' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#fbf6ec' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#d9c9ad' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#9a9083' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#d9cfbd' }] },
  { featureType: 'transit.station', elementType: 'labels.icon', stylers: [{ saturation: -100 }, { lightness: 20 }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#bfd3d0' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5f7a76' }] }
]

export const PAPER_DARK: Style = [
  { elementType: 'geometry', stylers: [{ color: '#24211e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a39a8e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1e1c1a' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#3a3631' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#2a2724' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#2a3026' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#3a3631' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#2c2925' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#4a443d' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#3a3631' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#2e3d3e' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#7d9693' }] }
]

const SILVER: Style = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
  { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9c9c9' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] }
]

const RETRO: Style = [
  { elementType: 'geometry', stylers: [{ color: '#ebe3cd' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#523735' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f1e6' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c9b2a6' }] },
  { featureType: 'administrative.land_parcel', elementType: 'geometry.stroke', stylers: [{ color: '#dcd2be' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#ae9e90' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#dfd2ae' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#dfd2ae' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#93817c' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#a5b076' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#447530' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#f5f1e6' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#fdfcf8' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f8c967' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#e9bc62' }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#e98d58' }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry.stroke', stylers: [{ color: '#db8555' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#806b63' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#dfd2ae' }] },
  { featureType: 'transit.line', elementType: 'labels.text.fill', stylers: [{ color: '#8f7d77' }] },
  { featureType: 'transit.line', elementType: 'labels.text.stroke', stylers: [{ color: '#ebe3cd' }] },
  { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#dfd2ae' }] },
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#b9d3c2' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#92998d' }] }
]

const DARK: Style = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#181818' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373737' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#4e4e4e' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] }
]

const NIGHT: Style = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#263c3f' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b9a76' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] }
]

const AUBERGINE: Style = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#64779e' }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#334e87' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#023e58' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6f9ba5' }] },
  { featureType: 'poi', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#023e58' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#3c7680' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#b0d5ce' }] },
  { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'transit.line', elementType: 'geometry.fill', stylers: [{ color: '#283d6a' }] },
  { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#3a4762' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6d70' }] }
]

export interface Swatch {
  land: string
  water: string
  road: string
  highway: string
  park: string
}

export interface MapLook {
  key: string
  name: string
  note: string
  mapTypeId: 'roadmap' | 'satellite' | 'hybrid' | 'terrain'
  styles?: Style
  /** Google's own dark colour scheme (needs the tilt-capable map). */
  dark?: boolean
  /** Colours for the small preview tile in the Map look switcher. */
  swatch: Swatch
}

/**
 * Google's own looks run on the tilt-capable (vector) map with our Map ID;
 * hand-made looks (those with `styles`) need the flat map, where Google
 * honours them, so tilt and rotate aren't available there (Hanh, session 4).
 */
export const canTilt = (l: MapLook) => !l.styles

// ---- Pins / No pins (Hanh, session 4) ----
// "No pins" hides Google's place pins: the icons and names of shops,
// restaurants, hospitals, schools and landmarks. Transit pins (bus, train,
// metro, airports) stay because they're useful, as do street, district and
// city names, roads and parks.

const PINS_OFF: Style = [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }]

/** Google dark's pins can't be hidden without a Google Cloud style. */
export const canHidePins = (l: MapLook) => !l.dark

export interface LookOptions {
  mapTypeId: MapLook['mapTypeId']
  /** Hand-made colours and/or the no-pins rules; null = Google's own look. */
  styles: Style | null
  /** True when this needs no hand-made styling, so the tilt map can show it. */
  tiltable: boolean
}

/**
 * What the map needs for a look with Google's place pins shown or hidden.
 * Hiding them needs a style, which only the flat map honours, so tilt and
 * rotate aren't available while pins are hidden (except on Google dark,
 * where pins can't be hidden at all yet).
 */
export function lookOptions(l: MapLook, pins: boolean): LookOptions {
  if (pins || !canHidePins(l)) return { mapTypeId: l.mapTypeId, styles: l.styles ?? null, tiltable: !l.styles }
  return { mapTypeId: l.mapTypeId, styles: [...(l.styles ?? []), ...PINS_OFF], tiltable: false }
}

const PINS_KEY = 'hanhs-log-map-pins'

/** Google's place pins shown (default) or hidden, remembered on this device. */
export function readPins(): boolean {
  try {
    return localStorage.getItem(PINS_KEY) !== 'off'
  } catch {
    return true
  }
}

export function savePins(on: boolean): void {
  try {
    if (on) localStorage.removeItem(PINS_KEY)
    else localStorage.setItem(PINS_KEY, 'off')
  } catch {
    /* storage unavailable: lasts for this visit only */
  }
}

// Order as in the approved switcher (session 4), plus Google dark. Defaults:
// Google standard in light mode, Google dark in dark mode (both can tilt);
// each mode remembers its own pick on this device.
export const MAP_LOOKS: MapLook[] = [
  { key: 'standard', name: 'Google standard', note: 'Everyday Google', mapTypeId: 'roadmap',
    swatch: { land: '#F2F3F4', water: '#A9D3F5', road: '#FFFFFF', highway: '#FCE8A8', park: '#CDE8C4' } },
  { key: 'google-dark', name: 'Google dark', note: "Google's own dark", mapTypeId: 'roadmap', dark: true,
    swatch: { land: '#1F2933', water: '#0E1A24', road: '#3B4652', highway: '#55606C', park: '#1E3328' } },
  { key: 'paper', name: 'Paper', note: "Hanh's Log muted", mapTypeId: 'roadmap', styles: PAPER,
    swatch: { land: '#F1EADB', water: '#BFD3D0', road: '#FFFFFF', highway: '#FBF6EC', park: '#DCE3C8' } },
  { key: 'paper-dark', name: 'Paper, dark', note: 'Paper at night', mapTypeId: 'roadmap', styles: PAPER_DARK,
    swatch: { land: '#24211E', water: '#2E3D3E', road: '#3A3631', highway: '#4A443D', park: '#2A3026' } },
  { key: 'silver', name: 'Silver', note: 'Light grey', mapTypeId: 'roadmap', styles: SILVER,
    swatch: { land: '#F5F5F5', water: '#C9C9C9', road: '#FFFFFF', highway: '#DADADA', park: '#E5E5E5' } },
  { key: 'retro', name: 'Retro', note: 'Vintage paper', mapTypeId: 'roadmap', styles: RETRO,
    swatch: { land: '#EBE3CD', water: '#B9D3C2', road: '#F5F1E6', highway: '#F8C967', park: '#A5B076' } },
  { key: 'dark', name: 'Dark', note: 'Charcoal', mapTypeId: 'roadmap', styles: DARK,
    swatch: { land: '#212121', water: '#000000', road: '#2C2C2C', highway: '#3C3C3C', park: '#181818' } },
  { key: 'night', name: 'Night', note: 'Navy and gold', mapTypeId: 'roadmap', styles: NIGHT,
    swatch: { land: '#242F3E', water: '#17263C', road: '#38414E', highway: '#746855', park: '#263C3F' } },
  { key: 'aubergine', name: 'Aubergine', note: 'Deep blue-teal', mapTypeId: 'roadmap', styles: AUBERGINE,
    swatch: { land: '#1D2C4D', water: '#0E1626', road: '#304A7D', highway: '#2C6675', park: '#023E58' } },
  { key: 'terrain', name: 'Terrain', note: 'Shaded hills', mapTypeId: 'terrain',
    swatch: { land: '#E8E4D6', water: '#9CC0E6', road: '#FFFFFF', highway: '#F6D78C', park: '#C6DDB0' } },
  // One Satellite look: aerial photos with street names (Hanh, session 4).
  { key: 'satellite', name: 'Satellite', note: 'Photos with names', mapTypeId: 'hybrid',
    swatch: { land: '#4B5442', water: '#2D4450', road: '#C9C2A6', highway: '#E3C770', park: '#3D5233' } }
]

export type Mode = 'light' | 'dark'
export const DEFAULT_LOOK: Record<Mode, string> = { light: 'standard', dark: 'google-dark' }
const lookKey = (mode: Mode) => `hanhs-log-map-look-${mode}`

/** The look picked on this device for this mode, or the mode's default. */
export function readLook(mode: Mode): MapLook {
  let k: string | null = null
  try {
    k = localStorage.getItem(lookKey(mode))
  } catch {
    /* storage unavailable: use the default */
  }
  if (k === 'hybrid') k = 'satellite' // "Satellite + labels" merged into Satellite (session 4)
  return MAP_LOOKS.find(l => l.key === k) ?? MAP_LOOKS.find(l => l.key === DEFAULT_LOOK[mode])!
}

/** Remember a pick on this device (null = back to the default). */
export function saveLook(mode: Mode, key: string | null): void {
  try {
    if (key === null) localStorage.removeItem(lookKey(mode))
    else localStorage.setItem(lookKey(mode), key)
  } catch {
    /* storage unavailable: the pick lasts for this visit only */
  }
}
