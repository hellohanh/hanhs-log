import { shownContact, telOf, websiteHref, type Contact } from '../lib/contact'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { placeDetails, siteLabel, type PlaceDetails } from '../lib/placeDetails'
import { popupLines } from '../lib/placeName'
import { badgeSvg, BADGE, type Badge } from '../lib/pinDraw'
import { afterRating, afterVerdict, type MyReview, type Verdict } from '../lib/pinRules'
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
  /** The ticked Vibe labels, shown under the name (session 14). */
  vibes?: string[]
  /** Saved address / phone / website (0026, session 16): win over Google's; '' hides one. */
  contact?: Partial<Contact>
}

/** Your own WTG / VIS on the popup (session 16, approved preview): stars
 * under the name, the pin's badge on the icon, and the circle under the bin
 * opening Revisit / 2nd try / No go. */
export interface PopupReview {
  mine: MyReview | null
  /** What the pin shows (everyone's latest), drawn on the icon. */
  badge: Badge
  onSave: (r: MyReview) => Promise<void>
}

const CHIPS: { v: Verdict; label: string }[] = [
  { v: 'revisit', label: 'Revisit' },
  { v: 'second', label: '2nd try' },
  { v: 'no', label: 'No go' }
]

export default function PlacePopup({
  place,
  onClose,
  onEdit,
  onDelete,
  onSaveNote,
  review,
  fill = false
}: {
  place: PopupPlace
  onClose: () => void
  onEdit: () => void
  onDelete: () => Promise<void>
  onSaveNote: (note: string) => Promise<void>
  /** Your badge and stars, editable right here (session 16). */
  review?: PopupReview
  /** Phone card (session 10): full width instead of the 350 px bubble. */
  fill?: boolean
}) {
  // Your review as shown (saved straight away; put back if the save fails).
  const [mine, setMine] = useState<MyReview>(review?.mine ?? { status: 'wtg', verdict: null, rating: null })
  const [chips, setChips] = useState(false)
  // Your change is the newest, so the icon's badge shows it straight away.
  const [touched, setTouched] = useState(false)
  // A different place: start fresh (the chips closed).
  useEffect(() => { setTouched(false); setChips(false) }, [place.name])
  // Your saved review changed (after a save reloads): show it, chips stay as they are.
  useEffect(() => {
    setMine(review?.mine ?? { status: 'wtg', verdict: null, rating: null })
  }, [place.name, review?.mine?.status, review?.mine?.verdict, review?.mine?.rating]) // eslint-disable-line react-hooks/exhaustive-deps
  const myBadge: Badge = mine.status === 'vis' && mine.verdict ? mine.verdict : 'wtg'
  async function saveReview(next: MyReview) {
    if (!review) return
    const before = mine
    setMine(next)
    setTouched(true)
    setErr('')
    try {
      await review.onSave(next)
    } catch (e) {
      setMine(before)
      setErr(`Couldn't save: ${(e as Error).message}`)
    }
  }
  const pickVerdict = (v: Verdict) => void saveReview(afterVerdict(mine, v))
  const pickRating = (r: number | null) => void saveReview(afterRating(mine, r))

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
  // What's saved wins; a field never saved shows Google's (session 16).
  const shown = {
    address: shownContact(place.contact?.address, info?.address ?? null),
    phone: shownContact(place.contact?.phone, info?.phone ?? null),
    website: shownContact(place.contact?.website, info?.website ?? null)
  }
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
  const noteRef = useRef<HTMLDivElement>(null)
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
      // The note too, when the taller column (with your badge) reaches it.
      const nt = noteRef.current
      if (nt) nt.style.paddingRight = nt.getBoundingClientRect().top - top < barBottom ? `${bar.offsetWidth}px` : '0'
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
        {review && (
          <button type="button" className={`${styles.icon} ${chips ? styles.iconOn : ''}`} aria-label={`Your badge: ${BADGE[myBadge].label}`} title="Your badge" aria-expanded={chips}
            onClick={() => setChips(c => !c)} dangerouslySetInnerHTML={{ __html: badgeSvg(myBadge, 20) }} />
        )}
      </div>
      <div className={styles.title}>
        {place.iconHtml && (
          <span className={styles.cat} aria-hidden="true">
            <span dangerouslySetInnerHTML={{ __html: place.iconHtml }} />
            {review && <span className={styles.catBadge} dangerouslySetInnerHTML={{ __html: badgeSvg(touched ? myBadge : review.badge, 20) }} />}
          </span>
        )}
        <div ref={namesRef} className={styles.names}>
          <span ref={spacerRef} className={styles.spacer} aria-hidden="true" />
          <b className={styles.en}>{main}</b>
          {local && <span className={styles.local}>{local}</span>}
          {review && <Stars value={mine.rating} onPick={pickRating} />}
          {place.vibes && place.vibes.length > 0 && <span className={styles.vibes}>{place.vibes.join(' · ')}</span>}
        </div>
      </div>
      {review && chips && (
        <div className={styles.chips} role="radiogroup" aria-label="Your badge">
          {CHIPS.map(c => {
            const on = mine.status === 'vis' && mine.verdict === c.v
            return (
              <button key={c.v} type="button" role="radio" aria-checked={on} className={styles.chip}
                onClick={() => { setChips(false); pickVerdict(c.v) }}>
                <span dangerouslySetInnerHTML={{ __html: badgeSvg(c.v, 20) }} />
                {c.label}
              </button>
            )
          })}
        </div>
      )}

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
          {shown.address && <p className={styles.line}><span aria-hidden="true">📍</span>{shown.address}</p>}
          {shown.phone && (
            <p className={styles.line}><span aria-hidden="true">📞</span><a href={`tel:${telOf(shown.phone)}`}>{shown.phone}</a></p>
          )}
          {shown.website && (
            <p className={styles.line}><span aria-hidden="true">🌐</span><a href={websiteHref(shown.website)} target="_blank" rel="noreferrer">{siteLabel(shown.website)}</a></p>
          )}
          <p className={styles.line}><span aria-hidden="true">↗</span><a href={info.mapsUrl} target="_blank" rel="noreferrer">View in Google Maps</a></p>
        </>
      )}
      <div className={styles.hr} />
      </div>

      <div ref={noteRef}>
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
      </div>
      {err && <p className={styles.err} role="alert">{err}</p>}
    </div>
  )
}

// Five grey stars under the name (session 16, approved preview): the left
// half of a star picks a half, the right half a whole one; tapping the same
// spot again clears it. Arrow keys step by halves.
const STAR = 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z'
function Stars({ value, onPick }: { value: number | null; onPick: (r: number | null) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover ?? value ?? 0
  const pick = (r: number) => { setHover(null); onPick(value === r ? null : r) }
  return (
    <span
      className={styles.stars}
      role="slider"
      tabIndex={0}
      aria-label="Your rating"
      aria-valuemin={0}
      aria-valuemax={5}
      aria-valuenow={value ?? 0}
      aria-valuetext={value ? `${value} of 5` : 'No rating'}
      onMouseLeave={() => setHover(null)}
      onKeyDown={e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onPick(Math.min(5, (value ?? 0) + 0.5)) }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); const r = (value ?? 0) - 0.5; onPick(r >= 1 ? r : r > 0 ? 0.5 : null) }
      }}
    >
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={styles.star}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d={STAR} fill="#D3D1C7" />
            {shown >= i - 0.5 && <path d={STAR} fill="#E8A81E" style={{ clipPath: shown >= i ? undefined : 'inset(0 50% 0 0)' }} />}
          </svg>
          <button type="button" tabIndex={-1} className={`${styles.half} ${styles.halfL}`} aria-label={`${i - 0.5} stars`}
            onPointerEnter={e => { if (e.pointerType === 'mouse') setHover(i - 0.5) }} onClick={() => pick(i - 0.5)} />
          <button type="button" tabIndex={-1} className={`${styles.half} ${styles.halfR}`} aria-label={`${i} star${i === 1 ? '' : 's'}`}
            onPointerEnter={e => { if (e.pointerType === 'mouse') setHover(i) }} onClick={() => pick(i)} />
        </span>
      ))}
      {shown > 0 && <span className={styles.starVal}>{shown.toFixed(1)}</span>}
    </span>
  )
}
