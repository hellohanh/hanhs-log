import { useState, type FormEvent } from 'react'
import TimeSelect from '../../components/TimeSelect'
import { hhmm, toMin } from '../../lib/itineraryDays'
export { STOP_MIN, nextStopStart } from '../../lib/itineraryDays'
import { HOUR_PX } from '../../lib/itineraryLayout'
import type { Stop, StopItem } from '../../lib/itinerary'
import { pinLook } from '../../lib/pinCatalog'
import { BADGE, badgeSvg, iconSvg, type Badge } from '../../lib/pinDraw'
import { useTimeBlockDrag } from './ActivityBlock'
import styles from './Itinerary.module.css'

// A place dropped onto a day: a time block on the timeline carrying its icon,
// colour and status badge. The place is a trip pin or a Savorlog eatery (both
// flattened to a StopItem). Drag the middle to move, the handles to resize, or
// click to open (session 4). The place itself is edited in Places.

export function StopBlock({
  stop,
  item,
  badge,
  pos,
  onChange,
  onOpen
}: {
  stop: Stop
  item: StopItem
  badge: Badge
  pos: { left: string; width: string }
  onChange: (start: string, end: string) => void
  onOpen: () => void
}) {
  const { shown, dragging, handlers } = useTimeBlockDrag(stop.start_time, stop.end_time, onChange, onOpen)
  const look = pinLook(item)
  const top = (shown.start / 60) * HOUR_PX
  const height = Math.max(18, ((shown.end - shown.start) / 60) * HOUR_PX)
  const short = height < 44
  const stars = item.michelin && item.michelin !== 'mentioned' ? ` · ${'★'.repeat(Number(item.michelin))}` : ''
  const label = `${item.name}, ${hhmm(shown.start)} to ${hhmm(shown.end)}`
  return (
    <div
      className={`${styles.act} ${styles.stop} ${short ? styles.actShort : ''} ${dragging ? styles.actDragging : ''}`}
      style={{ top, height, borderLeftColor: look.color, ...pos }}
      {...handlers('move')}
      onClick={e => e.stopPropagation()}
      role="button"
      tabIndex={0}
      aria-label={`${label}. Drag to move, or press Enter to open`}
      title={label}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      <span className={`${styles.handle} ${styles.handleTop}`} {...handlers('top')} aria-hidden="true" title="Drag to change the start" />
      <span className={styles.stopName}>
        <span className={styles.stopIcon} style={{ background: look.color }} dangerouslySetInnerHTML={{ __html: iconSvg(look.icon, 11) }} aria-hidden="true" />
        <b>{item.name}</b>
        <span className={styles.stopBadge} title={BADGE[badge].label} dangerouslySetInnerHTML={{ __html: badgeSvg(badge, 11) }} aria-hidden="true" />
      </span>
      <span className={styles.actTime}>{hhmm(shown.start)} – {hhmm(shown.end)}{stars}</span>
      <span className={`${styles.handle} ${styles.handleBottom}`} {...handlers('bottom')} aria-hidden="true" title="Drag to change the end" />
    </div>
  )
}

/** Edit a scheduled place: its times, or take it off the day. The place itself is edited in Places. */
export function StopEdit({
  stop,
  item,
  onSubmit,
  onCancel,
  onDelete
}: {
  stop: Stop
  item: StopItem
  onSubmit: (start: string, end: string) => Promise<void>
  onCancel: () => void
  onDelete: () => Promise<void>
}) {
  const [start, setStart] = useState(stop.start_time.slice(0, 5))
  const [end, setEnd] = useState(stop.end_time.slice(0, 5))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!start || !end || toMin(end) <= toMin(start)) return setError('The end time is before the start time.')
    setBusy(true)
    setError('')
    try {
      await onSubmit(start, end)
    } catch (err) {
      setError(`Couldn't save: ${(err as Error).message}`)
      setBusy(false)
    }
  }
  return (
    <form className={styles.addForm} onSubmit={submit} noValidate>
      <p className={styles.muted0}>Scheduled onto this day. Edit the place itself in Places.</p>
      <div className={styles.legRow}>
        <TimeSelect className={styles.lf} label="Start" value={start} onChange={setStart} />
        <TimeSelect className={styles.lf} label="End" value={end} onChange={setEnd} />
      </div>
      {error && <p className={styles.legError} role="alert">{error}</p>}
      {confirm ? (
        <div className={styles.confirm} role="alert">
          <span>Take {item.name} off this day?</span>
          <button type="button" className="btn" onClick={onDelete}>Remove</button>
          <button type="button" className="btn btn-quiet" onClick={() => setConfirm(false)}>Keep</button>
        </div>
      ) : (
        <div className={styles.legButtons}>
          <button type="button" className={`btn btn-quiet ${styles.legDelete}`} onClick={() => setConfirm(true)}>Remove</button>
          <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      )}
    </form>
  )
}
