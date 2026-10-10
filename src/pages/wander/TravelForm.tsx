import { useState, type FormEvent } from 'react'
import { AIRLINES, AIRPORTS } from '../../lib/airports'
import type { LegFields, LegMode, TravelLeg } from '../../lib/itinerary'
import { LEG_MODE_CONFIG, legDurationParts } from '../../lib/itineraryLayout'
import styles from './Itinerary.module.css'

// Add or edit a travel leg (flight, train, bus, own transport), as in old
// Wanderlog: flights get an airline picker (matching logo files) and an
// airport picker that also fills the time zone, so durations across time
// zones come out right.

const MODES: LegMode[] = ['flight', 'train', 'bus', 'personal']
const MODE_LABEL: Record<LegMode, string> = { flight: 'Flight', train: 'Train', bus: 'Bus', personal: 'Own transport' }
const ZONES: string[] = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? []
  } catch {
    return []
  }
})()

function airportLabel(a: { code: string; city: string }) {
  return `${a.city} / ${a.code}`
}

export default function TravelForm({
  dayId,
  dayDate,
  leg,
  preset,
  onSave,
  onDelete,
  onCancel
}: {
  dayId: string
  dayDate: string | null
  leg: TravelLeg | null
  /** From a click on the timeline: departure and arrival times to start with. */
  preset?: { from: string; to: string }
  onSave: (fields: LegFields, id?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onCancel: () => void
}) {
  const [mode, setMode] = useState<LegMode>(leg?.mode ?? 'flight')
  const [carrier, setCarrier] = useState(leg?.carrier ?? '')
  const [reference, setReference] = useState(leg?.reference ?? '')
  const [title, setTitle] = useState(leg?.title ?? '')
  const [from, setFrom] = useState(leg?.from_location ?? '')
  const [fromDate, setFromDate] = useState(leg?.from_date ?? dayDate ?? '')
  const [fromTime, setFromTime] = useState(leg?.from_time?.slice(0, 5) ?? preset?.from ?? '')
  const [fromZone, setFromZone] = useState(leg?.from_timezone ?? '')
  const [to, setTo] = useState(leg?.to_location ?? '')
  const [toDate, setToDate] = useState(leg?.to_date ?? dayDate ?? '')
  const [toTime, setToTime] = useState(leg?.to_time?.slice(0, 5) ?? preset?.to ?? '')
  const [toZone, setToZone] = useState(leg?.to_timezone ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Picking an airport fills its time zone too.
  function pickPlace(v: string, side: 'from' | 'to') {
    ;(side === 'from' ? setFrom : setTo)(v)
    const a = AIRPORTS.find(x => airportLabel(x).toLowerCase() === v.trim().toLowerCase())
    if (a) (side === 'from' ? setFromZone : setToZone)(a.timezone)
  }

  const fields: LegFields = {
    day_id: dayId,
    mode,
    carrier: carrier.trim() || null,
    reference: reference.trim() || null,
    title: title.trim() || null,
    from_location: from.trim(),
    from_date: fromDate || null,
    from_time: fromTime || null,
    from_timezone: fromZone.trim() || null,
    to_location: to.trim(),
    to_date: toDate || null,
    to_time: toTime || null,
    to_timezone: toZone.trim() || null
  }
  const duration = legDurationParts({ ...fields, id: '' })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!fields.from_location || !fields.to_location) return setError('Add where it leaves from and where it arrives.')
    setBusy(true)
    setError('')
    try {
      await onSave(fields, leg?.id)
    } catch (err) {
      setError(`Couldn't save: ${(err as Error).message}`)
      setBusy(false)
    }
  }

  const isFlight = mode === 'flight'
  return (
    <form className={styles.legForm} onSubmit={submit} aria-label={leg ? 'Edit travel' : 'Add travel'} noValidate>
      <div className={styles.legFormHead}>
        <strong>{leg ? 'Edit travel' : 'Add travel'}</strong>
      </div>
      <div role="radiogroup" aria-label="How" className={styles.modePills}>
        {MODES.map(m => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={m === mode}
            className={styles.modePill}
            style={m === mode ? { borderColor: LEG_MODE_CONFIG[m].color, color: LEG_MODE_CONFIG[m].color } : undefined}
            onClick={() => setMode(m)}
          >
            <span className={styles.modeDot} style={{ background: LEG_MODE_CONFIG[m].color }} dangerouslySetInnerHTML={{ __html: LEG_MODE_CONFIG[m].svg }} />
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>
      <div className={styles.legRow}>
        <label className={styles.lf}>
          {isFlight ? 'Airline' : 'Company'}
          <input value={carrier} onChange={e => setCarrier(e.target.value)} list={isFlight ? 'hl-airlines' : undefined} placeholder={isFlight ? 'Vietnam Airlines' : 'Optional'} />
        </label>
        <label className={styles.lf}>
          {isFlight ? 'Flight number' : 'Booking / ref'}
          <input value={reference} onChange={e => setReference(e.target.value)} placeholder={isFlight ? 'VN 300' : 'Optional'} />
        </label>
      </div>
      {!isFlight && (
        <label className={styles.lf}>
          Title (optional)
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Bus to Vũng Tàu" />
        </label>
      )}
      <fieldset className={styles.legSide}>
        <legend>From</legend>
        <label className={styles.lf}>
          {isFlight ? 'Airport' : 'Place'}
          <input value={from} onChange={e => pickPlace(e.target.value, 'from')} list={isFlight ? 'hl-airports' : undefined} placeholder={isFlight ? 'Tokyo / NRT' : 'Bến Thành'} />
        </label>
        <div className={styles.legRow}>
          <label className={styles.lf}>Date<input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></label>
          <label className={styles.lf}>Time<input type="time" step={300} value={fromTime} onChange={e => setFromTime(e.target.value)} /></label>
        </div>
        <label className={styles.lf}>Time zone<input value={fromZone} onChange={e => setFromZone(e.target.value)} list="hl-zones" placeholder={isFlight ? 'Filled from the airport' : 'Optional'} /></label>
      </fieldset>
      <fieldset className={styles.legSide}>
        <legend>To</legend>
        <label className={styles.lf}>
          {isFlight ? 'Airport' : 'Place'}
          <input value={to} onChange={e => pickPlace(e.target.value, 'to')} list={isFlight ? 'hl-airports' : undefined} placeholder={isFlight ? 'Ho Chi Minh City / SGN' : 'Vũng Tàu'} />
        </label>
        <div className={styles.legRow}>
          <label className={styles.lf}>Date<input type="date" value={toDate} onChange={e => setToDate(e.target.value)} /></label>
          <label className={styles.lf}>Time<input type="time" step={300} value={toTime} onChange={e => setToTime(e.target.value)} /></label>
        </div>
        <label className={styles.lf}>Time zone<input value={toZone} onChange={e => setToZone(e.target.value)} list="hl-zones" placeholder={isFlight ? 'Filled from the airport' : 'Optional'} /></label>
      </fieldset>
      {duration && <p className={styles.legDuration}>Takes {duration.hours}h {duration.minutes}m</p>}
      <datalist id="hl-airlines">{AIRLINES.map(a => <option key={a.value} value={a.value}>{a.display}</option>)}</datalist>
      <datalist id="hl-airports">{AIRPORTS.map(a => <option key={a.code} value={airportLabel(a)} />)}</datalist>
      <datalist id="hl-zones">{ZONES.map(z => <option key={z} value={z} />)}</datalist>
      {error && <p className={styles.legError} role="alert">{error}</p>}
      {confirmDelete && leg ? (
        <div className={styles.confirm} role="alert">
          <span>Delete this travel?</span>
          <button type="button" className="btn" onClick={() => onDelete(leg.id)}>Delete</button>
          <button type="button" className="btn btn-quiet" onClick={() => setConfirmDelete(false)}>Keep</button>
        </div>
      ) : (
        <div className={styles.legButtons}>
          {leg && <button type="button" className={`btn btn-quiet ${styles.legDelete}`} onClick={() => setConfirmDelete(true)}>Delete</button>}
          <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      )}
    </form>
  )
}
