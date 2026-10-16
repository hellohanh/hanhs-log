import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { placeDetails, siteLabel, type PlaceDetails } from '../lib/placeDetails'
import { popupLines } from '../lib/placeName'
import styles from './PlacePopup.module.css'

// The popup on a map pin (Hanh, session 10, approved preview). Clicking a pin
// (or a place in the left list) opens this instead of the edit panel: name
// with ✎ (opens the edit panel) and a bin (asks first), the address, phone
// and Google Maps link from Google, and the note, added or changed right here.

// Edit (Hanh, session 11): a yellow pencil with a red eraser.
const PENCIL = (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
    <g transform="rotate(45 12 12)" stroke="#3a3530" strokeWidth="0.9" strokeLinejoin="round">
      <rect x="9.4" y="1.6" width="5.2" height="3.4" rx="1.2" fill="#D93A35" />
      <rect x="9.4" y="5" width="5.2" height="1.8" fill="#B9B4AA" />
      <rect x="9.4" y="6.8" width="5.2" height="9.6" fill="#F2C230" />
      <path d="M9.4 16.4h5.2L12 21.6Z" fill="#EBC99A" />
      <path d="M11.1 19.8h1.8L12 21.6Z" fill="#3a3530" />
    </g>
  </svg>
)

export interface PopupPlace {
  name: string
  googlePlaceId: string | null
  lat: number
  lng: number
  note: string | null
  /** What the bin does, for the confirm line. */
  deleteText: string
  /** The category icon beside the name (session 11): ready-made HTML from popupIconHtml. */
  iconHtml?: string
}

export default function PlacePopup({
  place,
  onClose,
  onEdit,
  onDelete,
  onSaveNote,
  fill = false
}: {
  place: PopupPlace
  onClose: () => void
  onEdit: () => void
  onDelete: () => Promise<void>
  onSaveNote: (note: string) => Promise<void>
  /** Phone card (session 10): full width instead of the 350 px bubble. */
  fill?: boolean
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

  // English on top (bold), the local name below (session 11); a place with one
  // name shows it as the main line.
  const [main, local] = popupLines(place.name)

  // Text beside the button column keeps clear of it; below it, full width.
  const popRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const namesRef = useRef<HTMLDivElement>(null)
  const spacerRef = useRef<HTMLSpanElement>(null)
  const detRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const fit = () => {
      const pop = popRef.current, bar = barRef.current, names = namesRef.current, sp = spacerRef.current, det = detRef.current
      if (!pop || !bar || !names || !sp || !det) return
      const top = pop.getBoundingClientRect().top
      const barBottom = bar.getBoundingClientRect().bottom - top
      // Only as tall as the names need (a float taller than them would push
      // the address down); the address lines below step aside instead.
      const kids = Array.from(names.children).filter(k => k !== sp) as HTMLElement[]
      const textBottom = Math.max(...kids.map(k => k.getBoundingClientRect().bottom)) - names.getBoundingClientRect().top
      const need = barBottom - (names.getBoundingClientRect().top - top) + 2
      sp.style.height = `${Math.max(0, Math.min(need, textBottom))}px`
      det.style.paddingRight = det.getBoundingClientRect().top - top < barBottom ? `${bar.offsetWidth}px` : '0'
    }
    fit()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null
    if (popRef.current) ro?.observe(popRef.current)
    return () => ro?.disconnect()
  })

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
    <div ref={popRef} className={`${styles.pop} ${fill ? styles.fill : ''}`} role="dialog" aria-label={place.name}>
      {/* Session 11: close, edit and delete stacked down the right side. */}
      <div ref={barRef} className={styles.actions}>
        <button type="button" className={styles.icon} aria-label="Close" title="Close" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
        <button type="button" className={styles.icon} aria-label={`Edit ${place.name}`} title="Edit" onClick={onEdit}>
          {PENCIL}
        </button>
        <button type="button" className={`${styles.icon} ${styles.bin}`} aria-label={`Delete ${place.name}`} title="Delete" onClick={() => setConfirm(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
        </button>
      </div>
      <div className={styles.title}>
        {place.iconHtml && <span className={styles.cat} aria-hidden="true" dangerouslySetInnerHTML={{ __html: place.iconHtml }} />}
        <div ref={namesRef} className={styles.names}>
          <span ref={spacerRef} className={styles.spacer} aria-hidden="true" />
          <b className={styles.en}>{main}</b>
          {local && <span className={styles.local}>{local}</span>}
        </div>
      </div>

      {confirm && (
        <div className={styles.confirm} role="alert">
          <span>{place.deleteText}</span>
          <button type="button" className="btn" disabled={busy} onClick={() => run(onDelete)}>Delete</button>
          <button type="button" className="btn btn-quiet" onClick={() => setConfirm(false)}>Keep</button>
        </div>
      )}

      <div ref={detRef} className={styles.details}>
      {info === null ? (
        <p className={styles.muted}>Loading…</p>
      ) : (
        <>
          {info.address && <p className={styles.line}><span aria-hidden="true">📍</span>{info.address}</p>}
          {info.phone && (
            <p className={styles.line}><span aria-hidden="true">📞</span><a href={`tel:${info.tel}`}>{info.phone}</a></p>
          )}
          {info.website && (
            <p className={styles.line}><span aria-hidden="true">🌐</span><a href={info.website} target="_blank" rel="noreferrer">{siteLabel(info.website)}</a></p>
          )}
          <p className={styles.line}><span aria-hidden="true">↗</span><a href={info.mapsUrl} target="_blank" rel="noreferrer">View in Google Maps</a></p>
        </>
      )}
      <div className={styles.hr} />
      </div>

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
