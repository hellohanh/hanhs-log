import { useEffect, useRef, useState } from 'react'
import styles from './BottomSheet.module.css'

// The phone sheet (session 10; reworked session 13, E104, approved mockup):
// three stops — closed (only the coloured handle shows), half, full. Swipe
// the handle toward the middle of the screen to open it a stop further
// (closed → half → full); swipe it back toward its edge to close it
// completely. A tap on the handle steps open (closed → half → full → half).
// The handle is deep cherry red in light mode and mustard in dark mode.
// edge="bottom" (Places / Itinerary / Munch List catalogue) sits on the bottom
// of its positioned parent; edge="top" (Munch List search) hangs from the top.

export type Snap = 'closed' | 'half' | 'full'
/** The closed sheet: just its handle. */
export const HANDLE_PX = 30
/** How far a swipe must travel to count as a swipe (px). */
const SWIPE_PX = 24

export default function BottomSheet({
  snap,
  onSnap,
  label,
  hidden,
  edge = 'bottom',
  fit = false,
  children
}: {
  snap: Snap
  onSnap: (s: Snap) => void
  label: string
  /** Kept mounted but not shown (the other tab's sheet). */
  hidden?: boolean
  edge?: 'bottom' | 'top'
  /** Half = as tall as its contents, up to half the room (Munch List search). */
  fit?: boolean
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState(600)
  const [live, setLive] = useState<number | null>(null)
  const drag = useRef<{ y: number; h: number; moved: boolean } | null>(null)
  const top = edge === 'top'
  const inner = useRef<HTMLDivElement>(null)
  const [content, setContent] = useState(0)
  useEffect(() => {
    if (!fit || !inner.current || typeof ResizeObserver === 'undefined') return
    const el = inner.current
    const ro = new ResizeObserver(() => setContent(el.scrollHeight))
    ro.observe(el)
    setContent(el.scrollHeight)
    return () => ro.disconnect()
  }, [fit])

  useEffect(() => {
    const parent = ref.current?.parentElement
    if (!parent) return
    const measure = () => setRoom(parent.clientHeight)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(parent)
    return () => ro.disconnect()
  }, [])

  const halfPx = Math.round(room * 0.5)
  const heights: Record<Snap, number> = { closed: HANDLE_PX, half: fit && content > 0 ? Math.min(halfPx, content + HANDLE_PX) : halfPx, full: Math.max(HANDLE_PX, room - (top ? 0 : 8)) }
  const height = live ?? heights[snap]
  const closed = snap === 'closed' && live === null
  const stepOpen = (s: Snap): Snap => (s === 'closed' ? 'half' : s === 'half' ? 'full' : 'half')
  const opener = (s: Snap): Snap => (s === 'closed' ? 'half' : 'full')
  // Finger travel toward the middle of the screen (opening) is positive.
  const openBy = (startY: number, y: number) => (top ? y - startY : startY - y)

  const handle = (
    <div
      className={styles.grabZone}
      role="button"
      tabIndex={0}
      aria-label={`${label}: ${snap === 'full' ? 'make smaller' : 'make bigger'}`}
      onPointerDown={e => {
        ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
        drag.current = { y: e.clientY, h: height, moved: false }
      }}
      onPointerMove={e => {
        const d = drag.current
        if (!d) return
        const by = openBy(d.y, e.clientY)
        if (Math.abs(by) > 4) d.moved = true
        if (d.moved) setLive(Math.min(heights.full, Math.max(HANDLE_PX, d.h + by)))
      }}
      onPointerUp={e => {
        const d = drag.current
        drag.current = null
        setLive(null)
        if (!d) return
        const by = openBy(d.y, e.clientY)
        if (!d.moved) onSnap(stepOpen(snap))
        else if (by >= SWIPE_PX) onSnap(opener(snap))
        else if (by <= -SWIPE_PX) onSnap('closed')
      }}
      onPointerCancel={() => { drag.current = null; setLive(null) }}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSnap(stepOpen(snap))
        } else if (e.key === 'Escape' && snap !== 'closed') {
          e.preventDefault()
          onSnap('closed')
        }
      }}
    >
      <span className={styles.grab} aria-hidden="true" />
    </div>
  )

  return (
    <section
      ref={ref}
      className={`${styles.sheet} ${top ? styles.top : ''} ${closed ? styles.closed : ''} ${live !== null ? styles.dragging : ''}`}
      style={{ height, display: hidden ? 'none' : undefined }}
      aria-label={label}
      data-snap={snap}
    >
      {!top && handle}
      <div className={styles.body} style={{ overflowY: closed ? 'hidden' : 'auto', visibility: closed ? 'hidden' : undefined }}>
        <div ref={inner}>{children}</div>
      </div>
      {top && handle}
    </section>
  )
}
