import { useState } from 'react'
import styles from './CameraControl.module.css'

// Our own camera control (approved inline mockup, session 4), replacing
// Google's so it can carry tilt, rotate and reset. A 3 × 4 grid:
//   [tilt up,   up,    zoom in ]
//   [left,      reset, right   ]
//   [tilt down, down,  zoom out]
//   [rotate left, rotate right, open/close]
// Tilt steps 10°, rotate 15°. Reset returns to the trip's starting view:
// its city centre, zoom 13, flat, north up. Tilt and rotate need Google's
// vector map; on the older raster map they do nothing.

const PAN = 150
const TILT_STEP = 10
const TURN_STEP = 15

export default function CameraControl({ map, home }: { map: google.maps.Map; home: { center: google.maps.LatLngLiteral; zoom: number } }) {
  const [open, setOpen] = useState(true)
  const tilt = (d: number) => map.setTilt(Math.max(0, (map.getTilt() ?? 0) + d))
  const turn = (d: number) => map.setHeading((((map.getHeading() ?? 0) + d) % 360 + 360) % 360)
  const zoom = (d: number) => map.setZoom((map.getZoom() ?? home.zoom) + d)
  const reset = () => {
    map.setTilt(0)
    map.setHeading(0)
    map.setCenter(home.center)
    map.setZoom(home.zoom)
  }

  return (
    <div className={styles.grid} role="group" aria-label="Map camera">
      {open && (
        <>
          <Btn label="Tilt up 10°" onClick={() => tilt(TILT_STEP)}><TiltIcon /></Btn>
          <Btn label="Move up" onClick={() => map.panBy(0, -PAN)}><Chevron rot={0} /></Btn>
          <Btn label="Zoom in" onClick={() => zoom(1)}><Plus /></Btn>
          <Btn label="Move left" onClick={() => map.panBy(-PAN, 0)}><Chevron rot={-90} /></Btn>
          <Btn label="Reset to the trip's starting view" onClick={reset} reset><Target /></Btn>
          <Btn label="Move right" onClick={() => map.panBy(PAN, 0)}><Chevron rot={90} /></Btn>
          <Btn label="Tilt down 10°" onClick={() => tilt(-TILT_STEP)}><FlatIcon /></Btn>
          <Btn label="Move down" onClick={() => map.panBy(0, PAN)}><Chevron rot={180} /></Btn>
          <Btn label="Zoom out" onClick={() => zoom(-1)}><Minus /></Btn>
          <Btn label="Rotate left 15°" onClick={() => turn(-TURN_STEP)}><Turn left /></Btn>
          <Btn label="Rotate right 15°" onClick={() => turn(TURN_STEP)}><Turn /></Btn>
        </>
      )}
      <button
        type="button"
        className={`${styles.b} ${styles.toggle} ${open ? '' : styles.alone}`}
        aria-expanded={open}
        aria-label={open ? 'Close the camera controls' : 'Open the camera controls'}
        title="Camera controls"
        onClick={() => setOpen(o => !o)}
      >
        <MoveIcon />
      </button>
    </div>
  )
}

function Btn({ label, onClick, reset, children }: { label: string; onClick: () => void; reset?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" className={`${styles.b} ${reset ? styles.reset : ''}`} aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  )
}

const svg = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
const Chevron = ({ rot }: { rot: number }) => <svg {...svg} style={{ transform: `rotate(${rot}deg)` }}><path d="m6 15 6-6 6 6" /></svg>
const Plus = () => <svg {...svg}><path d="M12 5v14M5 12h14" /></svg>
const Minus = () => <svg {...svg}><path d="M5 12h14" /></svg>
const Target = () => <svg {...svg}><circle cx="12" cy="12" r="3" /><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /></svg>
const TiltIcon = () => <svg {...svg}><path d="M8 4h8l4 16H4L8 4Z" /></svg>
const FlatIcon = () => <svg {...svg}><rect x="4" y="4" width="16" height="16" rx="1" /></svg>
const Turn = ({ left }: { left?: boolean }) => (
  <svg {...svg} style={left ? { transform: 'scaleX(-1)' } : undefined}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></svg>
)
const MoveIcon = () => <svg {...svg}><path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" /></svg>
