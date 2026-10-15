import { useEffect, useState } from 'react'
import { placeDetails, type PlaceDetails } from '../lib/placeDetails'
import styles from './PlacePopup.module.css'

// The popup on a map pin (Hanh, session 10, approved preview). Clicking a pin
// (or a place in the left list) opens this instead of the edit panel: name
// with ✎ (opens the edit panel) and a bin (asks first), the address, phone
// and Google Maps link from Google, and the note, added or changed right here.

export interface PopupPlace {
  name: string
  googlePlaceId: string | null
  lat: number
  lng: number
  note: string | null
  /** What the bin does, for the confirm line. */
  deleteText: string
}

export default function PlacePopup({
  place,
  onClose,
  onEdit,
  onDelete,
  onSaveNote
}: {
  place: PopupPlace
  onClose: () => void
  onEdit: () => void
  onDelete: () => Promise<void>
  onSaveNote: (note: string) => Promise<void>
}) {
  const [info, setInfo] = useState<PlaceDetails | null>(null)
  const [editingNote, setEditingNote] = useState(false)
  const [note, setNote] = useState(place.note ?? '')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    setInfo(null)
    placeDetails(place.googlePlaceId, place).then(d => alive && setInfo(d))
    return () => { alive = false }
  }, [place.googlePlaceId, place.lat, place.lng]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setNote(place.note ?? '')
    setEditingNote(false)
    setConfirm(false)
  }, [place.name, place.note])

  async function run(job: () => Promise<void>) {
    setBusy(true)
    setErr('')
    try {
      await job()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.pop} role="dialog" aria-label={place.name}>
      <button type="button" className={styles.x} aria-label="Close" onClick={onClose}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
      <div className={styles.title}>
        <b>{place.name}</b>
        <button type="button" className={styles.icon} aria-label={`Edit ${place.name}`} title="Edit" onClick={onEdit}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
        </button>
        <button type="button" className={`${styles.icon} ${styles.bin}`} aria-label={`Delete ${place.name}`} title="Delete" onClick={() => setConfirm(true)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
        </button>
      </div>

      {confirm && (
        <div className={styles.confirm} role="alert">
          <span>{place.deleteText}</span>
          <button type="button" className="btn" disabled={busy} onClick={() => run(onDelete)}>Delete</button>
          <button type="button" className="btn btn-quiet" onClick={() => setConfirm(false)}>Keep</button>
        </div>
      )}

      {info === null ? (
        <p className={styles.muted}>Loading…</p>
      ) : (
        <>
          {info.address && <p className={styles.line}><span aria-hidden="true">📍</span>{info.address}</p>}
          {info.phone && (
            <p className={styles.line}><span aria-hidden="true">📞</span><a href={`tel:${info.tel}`}>{info.phone}</a></p>
          )}
          <p className={styles.line}><span aria-hidden="true">↗</span><a href={info.mapsUrl} target="_blank" rel="noreferrer">View in Google Maps</a></p>
        </>
      )}

      <div className={styles.hr} />
      {editingNote ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            run(async () => { await onSaveNote(note); setEditingNote(false) })
          }}
        >
          <textarea className={styles.note} aria-label="Note" value={note} onChange={e => setNote(e.target.value)} rows={3} autoFocus />
          <div className={styles.buttons}>
            <button type="button" className="btn btn-quiet" onClick={() => { setNote(place.note ?? ''); setEditingNote(false) }}>Cancel</button>
            <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save note'}</button>
          </div>
        </form>
      ) : place.note ? (
        <button type="button" className={styles.noteText} onClick={() => setEditingNote(true)} title="Change the note">{place.note}</button>
      ) : (
        <button type="button" className={styles.add} onClick={() => setEditingNote(true)}>+ add note</button>
      )}
      {err && <p className={styles.err} role="alert">{err}</p>}
    </div>
  )
}
