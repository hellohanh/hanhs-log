import { useEffect, useRef, useState } from 'react'
import { copyTripPins, fetchTrips, type TripSummary } from '../../lib/trips'
import { fetchPins, type Pin } from '../../lib/pins'
import { copyCounts } from '../../lib/pinRules'
import styles from './ShareDialog.module.css'

// Copy pins (session 14, approved mockup): pick another trip you're on and
// copy all its pins here — place, category, MICHELIN, Vibe, note and
// everyone's WTG / VIS (copy_trip_pins, migration 0018). Places already on
// this trip are skipped; the other trip is unchanged.
export default function CopyPinsDialog({ tripId, tripName, pins, onCopied, onClose }: {
  tripId: string
  tripName: string
  /** This trip's pins (to count what's already here). */
  pins: Pin[]
  onCopied: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [trips, setTrips] = useState<TripSummary[] | null>(null)
  const [from, setFrom] = useState('')
  const [theirs, setTheirs] = useState<Pin[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ copied: number; skipped: number } | null>(null)

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
    fetchTrips()
      .then(all => setTrips(all.filter(t => t.id !== tripId).sort((a, b) => a.name.localeCompare(b.name))))
      .catch(e => setError((e as Error).message))
  }, [tripId])

  useEffect(() => {
    setTheirs(null)
    if (!from) return
    let alive = true
    fetchPins(from).then(p => alive && setTheirs(p.filter(x => x.source !== 'spot'))).catch(e => alive && setError((e as Error).message))
    return () => { alive = false }
  }, [from])

  const counts = theirs ? copyCounts(theirs, pins) : null

  async function copy() {
    setBusy(true)
    setError('')
    try {
      setDone(await copyTripPins(from, tripId))
      onCopied()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const dates = (t: TripSummary) => (t.start_date ? ` · ${t.start_date}${t.end_date ? ` – ${t.end_date}` : ''}` : '')
  return (
    <dialog ref={ref} className={`segoe ${styles.dialog} ${styles.small}`} aria-labelledby="copy-title" onClose={onClose}>
      <div className={styles.head}>
        <h2 id="copy-title" className={styles.title}>Copy pins into {tripName}</h2>
        <button type="button" className={styles.close} aria-label="Close" onClick={() => ref.current?.close()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
      {done ? (
        <section className={styles.section}>
          <p role="status" style={{ margin: 0, fontWeight: 700, color: '#2F8A3E' }}>
            ✓ Copied {done.copied} pin{done.copied === 1 ? '' : 's'}{done.skipped > 0 ? ` · ${done.skipped} ${done.skipped === 1 ? 'was' : 'were'} already here` : ''}
          </p>
          <button type="button" className="btn btn-quiet" style={{ alignSelf: 'flex-start' }} onClick={() => ref.current?.close()}>Done</button>
        </section>
      ) : (
        <section className={styles.section}>
          <label htmlFor="copy-from" className={styles.label}>Copy from</label>
          {trips === null && !error ? (
            <p className={styles.help}>Loading your trips…</p>
          ) : trips && trips.length === 0 ? (
            <p className={styles.help}>You're not on any other trip yet.</p>
          ) : (
            <select id="copy-from" value={from} onChange={e => setFrom(e.target.value)} style={{ minHeight: 40, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--rule)', background: 'var(--ground)', color: 'var(--ink)', font: 'inherit' }}>
              <option value="">Pick a trip</option>
              {(trips ?? []).map(t => <option key={t.id} value={t.id}>{t.name}{dates(t)}</option>)}
            </select>
          )}
          {counts && (
            <p style={{ margin: 0 }}>
              {counts.total} pin{counts.total === 1 ? '' : 's'} · <b>{counts.toCopy} to copy</b>{counts.already > 0 ? ` · ${counts.already} already here` : ''}
            </p>
          )}
          <p className={styles.help}>Brings each place's category, MICHELIN, Vibe, note and everyone's WTG / VIS. Eateries already show on every trip.</p>
          {error && <p role="alert" style={{ margin: 0, color: '#C8352F' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn" disabled={busy || !counts || counts.toCopy === 0} onClick={() => void copy()}>
              {busy ? 'Copying…' : counts ? `Copy all ${counts.toCopy}` : 'Copy all'}
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => ref.current?.close()}>Cancel</button>
          </div>
        </section>
      )}
    </dialog>
  )
}
