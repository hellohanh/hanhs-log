import { useEffect, useRef, useState } from 'react'
import styles from './BottomSheet.module.css'

// The phone bottom sheet (session 10, approved): three heights — peek (just
// its header), half (list and map together), full. Drag the handle up or
// down and it settles on the nearest height; a tap on the handle steps up
// (peek → half → full → half). It never hides fully, so its header is
// always there to grab. Sits in a positioned parent (between the title bar
// and the bottom bar) and measures it.

export type Snap = 'peek' | 'half' | 'full'
export const PEEK_PX = 76

export default function BottomSheet({
  snap,
  onSnap,
  label,
  hidden,
  children
}: {
  snap: Snap
  onSnap: (s: Snap) => void
  label: string
  /** Kept mounted but not shown (the other tab's sheet). */
  hidden?: boolean
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState(600)
  const [live, setLive] = useState<number | null>(null)
  const drag = useRef<{ y: number; h: number; moved: boolean } | null>(null)

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

  const heights: Record<Snap, number> = { peek: PEEK_PX, half: Math.round(room * 0.5), full: Math.max(PEEK_PX, room - 8) }
  const height = live ?? heights[snap]

  const nearest = (h: number): Snap =>
    (Object.keys(heights) as Snap[]).reduce((best, k) => (Math.abs(heights[k] - h) < Math.abs(heights[best] - h) ? k : best), 'peek')

  return (
    <section
      ref={ref}
      className={`${styles.sheet} ${live !== null ? styles.dragging : ''}`}
      style={{ height, display: hidden ? 'none' : undefined }}
      aria-label={label}
      data-snap={snap}
    >
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
          const dy = d.y - e.clientY
          if (Math.abs(dy) > 4) d.moved = true
          if (d.moved) setLive(Math.min(heights.full, Math.max(PEEK_PX, d.h + dy)))
        }}
        onPointerUp={e => {
          const d = drag.current
          drag.current = null
          if (!d) return
          if (!d.moved) {
            onSnap(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'half')
          } else {
            onSnap(nearest(Math.min(heights.full, Math.max(PEEK_PX, d.h + (d.y - e.clientY)))))
          }
          setLive(null)
        }}
        onPointerCancel={() => { drag.current = null; setLive(null) }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSnap(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'half')
          }
        }}
      >
        <span className={styles.grab} aria-hidden="true" />
      </div>
      <div className={styles.body} style={{ overflowY: snap === 'peek' && live === null ? 'hidden' : 'auto' }}>
        {children}
      </div>
    </section>
  )
}
