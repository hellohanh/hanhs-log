import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { Activity } from '../../lib/itinerary'
import { dragTimes, hhmm, toMin } from '../../lib/itineraryDays'
import { HOUR_PX } from '../../lib/itineraryLayout'
import styles from './Itinerary.module.css'

// Activity blocks and the "Add at …" popup (approved inline mockup,
// session 4). Clicking an empty spot on the timeline opens the popup at the
// 15-minute mark under the pointer, 30 minutes long. Activities have a handle
// at the top and bottom (5-minute steps) and can be dragged to a new time;
// a click without dragging opens them to edit. Travel legs stay fixed.

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
  onAddActivity,
  onTravel,
  onCancel
}: {
  startPx: number
  endPx: number
  start: number
  end: number
  onAddActivity: (title: string, start: string, end: string) => Promise<void>
  onTravel: (start: string, end: string) => void
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
        <Kind k="place" label="Place" sub="comes with pins" kind={kind} setKind={setKind} />
      </div>
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
    if (kind === 'place') return
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
      {kind === 'place' && <p className={styles.muted0}>Picking one of the trip's places comes with pins (step 4).</p>}
      {kind !== 'place' && (
        <div className={styles.legRow}>
          <label className={styles.lf}>Start<input type="time" step={300} value={start} onChange={e => setStart(e.target.value)} /></label>
          <label className={styles.lf}>End<input type="time" step={300} value={end} onChange={e => setEnd(e.target.value)} /></label>
        </div>
      )}
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
          <button type="submit" className="btn" disabled={busy || kind === 'place'}>{busy ? 'Saving…' : kind === 'travel' ? 'Next' : submitLabel}</button>
        </div>
      )}
    </form>
  )
}

type Part = 'top' | 'bottom' | 'move'

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
  const s0 = toMin(activity.start_time)
  const e0 = toMin(activity.end_time)
  const [live, setLive] = useState<{ start: number; end: number } | null>(null)
  const drag = useRef<{ part: Part; y: number; moved: boolean } | null>(null)
  const shown = live ?? { start: s0, end: e0 }

  useEffect(() => setLive(null), [activity.start_time, activity.end_time])

  function down(part: Part) {
    return (e: ReactPointerEvent<HTMLElement>) => {
      e.stopPropagation()
      e.preventDefault()
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
      drag.current = { part, y: e.clientY, moved: false }
    }
  }
  function move(e: ReactPointerEvent<HTMLElement>) {
    const d = drag.current
    if (!d) return
    const dy = e.clientY - d.y
    if (Math.abs(dy) > 3) d.moved = true
    if (d.moved) setLive(dragTimes(s0, e0, (dy / HOUR_PX) * 60, d.part))
  }
  function up(e: ReactPointerEvent<HTMLElement>) {
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

  const top = (shown.start / 60) * HOUR_PX
  const height = Math.max(18, ((shown.end - shown.start) / 60) * HOUR_PX)
  const label = `${activity.title}, ${hhmm(shown.start)} to ${hhmm(shown.end)}`
  return (
    <div
      className={`${styles.act} ${height < 44 ? styles.actShort : ''} ${live ? styles.actDragging : ''}`}
      style={{ top, height, ...pos }}
      onPointerDown={down('move')}
      onPointerMove={move}
      onPointerUp={up}
      onClick={e => e.stopPropagation()}
      role="button"
      tabIndex={0}
      aria-label={`${label}. Drag to move, or press Enter to edit`}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      <span className={`${styles.handle} ${styles.handleTop}`} onPointerDown={down('top')} onPointerMove={move} onPointerUp={up} aria-hidden="true" title="Drag to change the start" />
      <b>{activity.title}</b>
      <span className={styles.actTime}>{hhmm(shown.start)} – {hhmm(shown.end)}</span>
      <span className={`${styles.handle} ${styles.handleBottom}`} onPointerDown={down('bottom')} onPointerMove={move} onPointerUp={up} aria-hidden="true" title="Drag to change the end" />
    </div>
  )
}
