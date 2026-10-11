import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { Activity } from '../../lib/itinerary'
import { dragTimes, hhmm, toMin } from '../../lib/itineraryDays'
import { HOUR_PX } from '../../lib/itineraryLayout'
import { pinLook } from '../../lib/pinCatalog'
import type { Pin } from '../../lib/pins'
import styles from './Itinerary.module.css'

// Activity blocks and the "Add at …" popup (approved inline mockup,
// session 4). Clicking an empty spot on the timeline opens the popup at the
// 15-minute mark under the pointer, 30 minutes long. Activities have a handle
// at the top and bottom (5-minute steps) and can be dragged to a new time;
// a click without dragging opens them to edit. Travel legs stay fixed.
// "Place" picks one of the trip's pins to schedule at the clicked time; a pin
// can also be dragged in or added from the Places panel (Hanh, session 4).
export type AddKind = 'activity' | 'travel' | 'place'

/**
 * Place a popup above or below a time range on the timeline, whichever side
 * has more room in the part of the timeline that's on screen, without
 * scrolling (so the clicked spot stays in view). On a short window where it
 * fits on neither side, it docks over the day tabs instead, leaving the
 * whole timeline visible.
 */
export function usePopupStyle(box: React.RefObject<HTMLDivElement | null>, startPx: number, endPx: number): React.CSSProperties {
  const [style, setStyle] = useState<React.CSSProperties>({ top: endPx + 6, visibility: 'hidden' })
  useLayoutEffect(() => {
    const el = box.current
    const scroller = el?.closest('[data-scroll="timeline"]') as HTMLElement | null
    if (!el || !scroller) return
    const h = el.offsetHeight
    const viewTop = scroller.scrollTop
    const viewBottom = viewTop + scroller.clientHeight
    const below = viewBottom - endPx
    const above = startPx - viewTop
    if (below >= h + 6) return setStyle({ top: endPx + 6 })
    if (above >= h + 6) return setStyle({ top: startPx - h - 6 })
    const r = scroller.getBoundingClientRect()
    setStyle({ position: 'fixed', top: Math.max(8, r.top - h - 8), left: r.left + 8, right: 'auto', width: r.width - 16 })
  }, [box, startPx, endPx])
  return style
}

export function AddPopup({
  startPx,
  endPx,
  start,
  end,
  pins,
  onAddActivity,
  onTravel,
  onAddPlace,
  onCancel
}: {
  startPx: number
  endPx: number
  start: number
  end: number
  pins: Pin[]
  onAddActivity: (title: string, start: string, end: string) => Promise<void>
  onTravel: (start: string, end: string) => void
  onAddPlace: (pinId: string, start: string, end: string) => Promise<void>
  onCancel: () => void
}) {
  const [kind, setKind] = useState<AddKind>('activity')
  const box = useRef<HTMLDivElement>(null)
  const pos = usePopupStyle(box, startPx, endPx)
  return (
    <div ref={box} className={styles.addPop} style={pos} role="dialog" aria-label={`Add at ${hhmm(start)}`} onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
      <div className={styles.addHead}>
        <strong>Add at {hhmm(start)}</strong>
        <button type="button" className={styles.ib} aria-label="Close" onClick={onCancel}>×</button>
      </div>
      <div role="radiogroup" aria-label="What to add" className={styles.kinds}>
        <Kind k="activity" label="Activity" sub="free text" kind={kind} setKind={setKind} />
        <Kind k="travel" label="Travel" sub="flight, bus…" kind={kind} setKind={setKind} />
        <Kind k="place" label="Place" sub="a trip pin" kind={kind} setKind={setKind} />
      </div>
      {kind === 'place' ? (
        <PinPicker pins={pins} onPick={pinId => onAddPlace(pinId, hhmm(start), hhmm(end))} onCancel={onCancel} />
      ) : (
        <ActivityFields
          key={kind}
          kind={kind}
          initial={{ title: '', start: hhmm(start), end: hhmm(end) }}
          submitLabel="Add"
          onCancel={onCancel}
          onSubmit={async (title, s, e) => {
            if (kind === 'travel') return onTravel(s, e)
            await onAddActivity(title, s, e)
          }}
        />
      )}
    </div>
  )
}

/** Pick one of the trip's pins to schedule (grouped by category). */
function PinPicker({ pins, onPick, onCancel }: { pins: Pin[]; onPick: (pinId: string) => void | Promise<void>; onCancel: () => void }) {
  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? pins.filter(p => p.name.toLowerCase().includes(t)) : pins
  }, [pins, q])
  if (pins.length === 0) return <p className={styles.muted0}>No pins yet — add places in the Places panel first.</p>
  return (
    <div className={styles.pickWrap}>
      <input className={styles.pickSearch} value={q} onChange={e => setQ(e.target.value)} placeholder="Find a pin" aria-label="Find a pin" autoFocus />
      <ul className={styles.pickList}>
        {shown.map(p => {
          const look = pinLook(p)
          const star = p.michelin && p.michelin !== 'mentioned' ? ` ★${p.michelin}` : p.michelin === 'mentioned' ? ' ◈' : ''
          return (
            <li key={p.id}>
              <button type="button" className={styles.pickItem} onClick={() => onPick(p.id)}>
                <span className={styles.pickDot} style={{ background: look.color }} aria-hidden="true" />
                <span className={styles.pickName}>{p.name}</span>
                <small>{look.parts[0]}{star}</small>
              </button>
            </li>
          )
        })}
        {shown.length === 0 && <li className={styles.muted0}>No pin matches “{q}”.</li>}
      </ul>
      <div className={styles.legButtons}><button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button></div>
    </div>
  )
}

function Kind({ k, label, sub, kind, setKind }: { k: AddKind; label: string; sub: string; kind: AddKind; setKind: (k: AddKind) => void }) {
  return (
    <button type="button" role="radio" aria-checked={k === kind} className={styles.kind} onClick={() => setKind(k)}>
      {label}
      <small>{sub}</small>
    </button>
  )
}

/** Title (activities only) and start/end, used to add and to edit. */
export function ActivityFields({
  kind = 'activity',
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete
}: {
  kind?: AddKind
  initial: { title: string; start: string; end: string }
  submitLabel: string
  onSubmit: (title: string, start: string, end: string) => Promise<void> | void
  onCancel: () => void
  onDelete?: () => Promise<void>
}) {
  const [title, setTitle] = useState(initial.title)
  const [start, setStart] = useState(initial.start)
  const [end, setEnd] = useState(initial.end)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  useEffect(() => titleRef.current?.focus({ preventScroll: true }), [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (kind === 'activity' && !title.trim()) return setError('Say what the activity is.')
    if (!start || !end || toMin(end) <= toMin(start)) return setError('The end time is before the start time.')
    setBusy(true)
    setError('')
    try {
      await onSubmit(title.trim(), start, end)
    } catch (err) {
      setError(`Couldn't save: ${(err as Error).message}`)
      setBusy(false)
    }
  }

  return (
    <form className={styles.addForm} onSubmit={submit} noValidate>
      {kind === 'activity' && (
        <label className={styles.lf}>
          What
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Massage at Miu Miu Spa" maxLength={200} ref={titleRef} />
        </label>
      )}
      {kind === 'travel' && <p className={styles.muted0}>Opens the travel form with these times filled in.</p>}
      <div className={styles.legRow}>
        <label className={styles.lf}>Start<input type="time" step={300} value={start} onChange={e => setStart(e.target.value)} /></label>
        <label className={styles.lf}>End<input type="time" step={300} value={end} onChange={e => setEnd(e.target.value)} /></label>
      </div>
      {error && <p className={styles.legError} role="alert">{error}</p>}
      {confirm && onDelete ? (
        <div className={styles.confirm} role="alert">
          <span>Delete this activity?</span>
          <button type="button" className="btn" onClick={onDelete}>Delete</button>
          <button type="button" className="btn btn-quiet" onClick={() => setConfirm(false)}>Keep</button>
        </div>
      ) : (
        <div className={styles.legButtons}>
          {onDelete && <button type="button" className={`btn btn-quiet ${styles.legDelete}`} onClick={() => setConfirm(true)}>Delete</button>}
          <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving…' : kind === 'travel' ? 'Next' : submitLabel}</button>
        </div>
      )}
    </form>
  )
}

type Part = 'top' | 'bottom' | 'move'
type Handlers = {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void
}

/**
 * Pointer-drag for a time block on the timeline: the middle moves it, the top
 * and bottom handles resize it (5-minute steps), and a click without dragging
 * opens it. Shared by activity blocks and place (stop) blocks (session 4).
 */
export function useTimeBlockDrag(
  startTime: string,
  endTime: string,
  onChange: (start: string, end: string) => void,
  onOpen: () => void
): { shown: { start: number; end: number }; dragging: boolean; handlers: (part: Part) => Handlers } {
  const s0 = toMin(startTime)
  const e0 = toMin(endTime)
  const [live, setLive] = useState<{ start: number; end: number } | null>(null)
  const drag = useRef<{ part: Part; y: number; moved: boolean } | null>(null)
  const shown = live ?? { start: s0, end: e0 }

  useEffect(() => setLive(null), [startTime, endTime])

  const handlers = (part: Part): Handlers => ({
    onPointerDown(e) {
      e.stopPropagation()
      e.preventDefault()
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
      drag.current = { part, y: e.clientY, moved: false }
    },
    onPointerMove(e) {
      const d = drag.current
      if (!d) return
      const dy = e.clientY - d.y
      if (Math.abs(dy) > 3) d.moved = true
      if (d.moved) setLive(dragTimes(s0, e0, (dy / HOUR_PX) * 60, d.part))
    },
    onPointerUp(e) {
      const d = drag.current
      drag.current = null
      e.stopPropagation()
      if (!d) return
      if (!d.moved) {
        if (d.part === 'move') onOpen()
        return
      }
      const next = dragTimes(s0, e0, ((e.clientY - d.y) / HOUR_PX) * 60, d.part)
      if (next.start !== s0 || next.end !== e0) onChange(hhmm(next.start), hhmm(next.end))
      else setLive(null)
    }
  })

  return { shown, dragging: live !== null, handlers }
}

export function ActivityBlock({
  activity,
  pos,
  onChange,
  onOpen
}: {
  activity: Activity
  pos: { left: string; width: string }
  onChange: (start: string, end: string) => void
  onOpen: () => void
}) {
  const { shown, dragging, handlers } = useTimeBlockDrag(activity.start_time, activity.end_time, onChange, onOpen)
  const top = (shown.start / 60) * HOUR_PX
  const height = Math.max(18, ((shown.end - shown.start) / 60) * HOUR_PX)
  const label = `${activity.title}, ${hhmm(shown.start)} to ${hhmm(shown.end)}`
  return (
    <div
      className={`${styles.act} ${height < 44 ? styles.actShort : ''} ${dragging ? styles.actDragging : ''}`}
      style={{ top, height, ...pos }}
      {...handlers('move')}
      onClick={e => e.stopPropagation()}
      role="button"
      tabIndex={0}
      aria-label={`${label}. Drag to move, or press Enter to edit`}
      title={label}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      <span className={`${styles.handle} ${styles.handleTop}`} {...handlers('top')} aria-hidden="true" title="Drag to change the start" />
      <b>{activity.title}</b>
      <span className={styles.actTime}>{hhmm(shown.start)} – {hhmm(shown.end)}</span>
      <span className={`${styles.handle} ${styles.handleBottom}`} {...handlers('bottom')} aria-hidden="true" title="Drag to change the end" />
    </div>
  )
}
