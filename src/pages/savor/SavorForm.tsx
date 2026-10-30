import { useEffect, useState, type FormEvent } from 'react'
import { googleName } from '../../lib/placeDetails'
import { byLabel, categoryOf, pinLook } from '../../lib/pinCatalog'
import { BADGE, pinHtml, type Michelin } from '../../lib/pinDraw'
import { MICHELIN_ROWS, vibesOf, type Vibes } from '../../lib/vibe'
import VibeFields from '../../components/VibeFields'
import DishPicker from '../../components/DishPicker'
import { pinBadge, averageRating, type Verdict, type Review } from '../../lib/pinRules'
import type { FoundPlace } from '../../lib/pins'
import {
  saveEatery, saveMyEateryReview, requestEateryDeletion, asReviews, priceLabel,
  fetchEateryPhotos, addEateryPhoto, removeEateryPhoto, photoUrl, googlePhotoUrl, MAX_PHOTOS,
  type Eatery, type EateryFields, type EateryReview, type EateryPhoto
} from '../../lib/eateries'
import styles from './Savor.module.css'
import NameFields from '../../components/NameFields'
import ContactFields, { useContactFields } from '../../components/ContactFields'
import { joinName, splitName } from '../../lib/placeName'
import type { ImportPrefill } from '../../lib/pinImport'
import ImportButtons, { type ImportActions } from '../../components/ImportButtons'

// The add / edit eatery card (approved mockup, 4d): the place from Google, its
// cuisine → dish picked by hand, price ($–$$$$), MICHELIN (None / Selected / Bib, then the
// stars), the Vibe ticks (session 14), your WTG / VIS review, a note, and up to 3 photos (uploaded
// after the eatery exists; otherwise a Google photo, then a placeholder).

const VERDICTS: { v: Verdict; mark: string; label: string }[] = [
  { v: 'revisit', mark: '✓', label: 'Revisit' },
  { v: 'second', mark: '–', label: '2nd chance' },
  { v: 'no', mark: '✗', label: "Don't go back" }
]
const FOOD = categoryOf('food')!
// The cuisine picker is A–Z (session 11, Hanh); the dish picker keeps catalogue order.
const CUISINES = [...FOOD.subs].sort(byLabel)

export default function SavorForm({
  userId,
  place,
  eatery,
  reviews,
  onCancel,
  onSaved,
  prefill,
  importActions
}: {
  userId: string
  place?: FoundPlace
  eatery?: Eatery
  reviews: EateryReview[]
  onCancel: () => void
  onSaved: (id: string) => void
  /** Values Claude prepared for an old Wanderlog pin (E71); ignored when editing. */
  prefill?: ImportPrefill
  /** The import queue's Skip for good / Back / Save and next (E71). */
  importActions?: ImportActions
}) {
  const pre = eatery ? undefined : prefill
  const mine = reviews.find(r => r.user_id === userId)
  const [names, setNames] = useState(() =>
    pre ? { en: pre.name_en ?? '', local: pre.name_local ?? '' } : splitName(eatery?.name ?? place?.name)
  )
  const name = joinName(names.en, names.local, names.exact)
  // Google's spelling for the suggestion under the name boxes (session 14).
  const [google, setGoogle] = useState<string | null>(place?.name ?? null)
  useEffect(() => {
    if (place || !eatery?.google_place_id) return
    let alive = true
    googleName(eatery.google_place_id).then(n => alive && setGoogle(n))
    return () => { alive = false }
  }, [place, eatery?.google_place_id])
  const [cuisine, setCuisine] = useState(eatery?.cuisine ?? pre?.sub ?? '')
  const [dish, setDish] = useState(eatery?.dish ?? pre?.leaf ?? '')
  const [price, setPrice] = useState<number | null>(eatery?.price ?? null)
  const [michelin, setMichelin] = useState<Michelin>(eatery?.michelin ?? pre?.michelin ?? null)
  const [year, setYear] = useState(String(eatery?.michelin_year ?? pre?.michelin_year ?? new Date().getFullYear()))
  const [vibes, setVibes] = useState<Vibes>(() => vibesOf(eatery ?? pre))
  const [note, setNote] = useState(eatery?.note ?? pre?.note ?? '')
  const [review, setReview] = useState({ status: mine?.status ?? ('wtg' as 'wtg' | 'vis'), verdict: mine?.verdict ?? null, rating: mine?.rating ?? null })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const subObj = FOOD.subs.find(s => s.key === cuisine)
  // Address, phone, website (session 16): editable, filled in from Google.
  const contact = useContactFields(
    eatery ? { address: eatery.address, phone: eatery.phone ?? null, website: eatery.website ?? null } : undefined,
    eatery ? { placeId: eatery.google_place_id, lat: eatery.lat, lng: eatery.lng } : place ? { placeId: place.id, lat: place.lat, lng: place.lng, address: place.address } : null
  )
  const look = pinLook({ category: 'food', subcategory: cuisine || null, subsubcategory: dish || null })
  const asSaved: Review[] = [
    ...asReviews(reviews, eatery?.id ?? '').filter(r => r.user_id !== userId),
    { pin_id: '', user_id: userId, status: review.status, verdict: review.verdict, rating: review.rating, updated_at: '9999' }
  ]
  const preview = pinHtml({ color: look.color, icon: look.icon, michelin, badge: pinBadge(asSaved) })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Give the eatery a name.')
    if (!cuisine) return setError('Pick a cuisine.')
    if (review.status === 'vis' && !review.verdict) return setError('Pick ✓, – or ✗ to save it as visited.')
    const y = Number(year)
    if (michelin && (!Number.isInteger(y) || y < 1900 || y > 2100)) return setError('Give the MICHELIN year, like 2026.')
    const fields: EateryFields = {
      google_place_id: eatery?.google_place_id ?? place?.id ?? null,
      name,
      ...contact.values(),
      lat: eatery?.lat ?? place!.lat,
      lng: eatery?.lng ?? place!.lng,
      cuisine: cuisine || null,
      dish: dish || null,
      michelin,
      michelin_year: michelin ? y : null,
      ...vibes,
      price,
      note: note.trim() || null
    }
    setBusy(true)
    setError('')
    try {
      const id = await saveEatery(fields, eatery?.id)
      const changed = !mine || mine.status !== review.status || mine.verdict !== review.verdict || mine.rating !== review.rating
      if (changed) await saveMyEateryReview(id, userId, review)
      onSaved(id)
    } catch (err) {
      setError(`Couldn't save: ${(err as Error).message}`)
      setBusy(false)
    }
  }

  async function remove() {
    if (!eatery) return
    setBusy(true)
    try {
      await requestEateryDeletion(eatery.id)
      onSaved('')
    } catch (err) {
      setError(`Couldn't remove: ${(err as Error).message}`)
      setBusy(false)
    }
  }

  const rated = reviews.filter(r => r.rating != null).length
  const avg = averageRating(asReviews(reviews, eatery?.id ?? ''))

  return (
    <form className={styles.card} onSubmit={submit} noValidate aria-label={eatery ? 'Edit eatery' : 'Add an eatery'}>
      <div className={styles.cardHead}>
        <strong>{eatery ? 'Edit eatery' : 'Add an eatery'}</strong>
        <span className={styles.preview} dangerouslySetInnerHTML={{ __html: preview }} aria-hidden="true" />
        <button type="button" className={styles.x} aria-label="Close" onClick={onCancel}>×</button>
      </div>

      <NameFields value={names} onChange={setNames} fieldClass={styles.field} hintClass={styles.path} google={google} />
      <ContactFields state={contact} fieldClass={styles.field} />

      <fieldset className={styles.group}>
        <legend>Cuisine &amp; dish</legend>
        <select aria-label="Cuisine (country)" value={cuisine} onChange={e => { setCuisine(e.target.value); setDish('') }}>
          <option value="">Pick a cuisine</option>
          {CUISINES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        {/* Main dish A–Z with "+ Add a new dish…" (session 14). */}
        {subObj && <DishPicker cuisine={subObj} value={dish} onChange={setDish} />}
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Price</legend>
        <div className={styles.seg} role="radiogroup" aria-label="Price">
          {[1, 2, 3, 4].map(p => (
            <button key={p} type="button" role="radio" aria-checked={price === p} aria-label={`${p} of 4`} className={`${styles.segBtn} ${styles.priceBtn}`} onClick={() => setPrice(price === p ? null : p)}>
              {priceLabel(p)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>MICHELIN Guide</legend>
        <div role="radiogroup" aria-label="MICHELIN" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {MICHELIN_ROWS.map((row, i) => (
            <div key={i} className={styles.seg}>
              {row.map(({ m, label, aria }) => (
                <button key={aria} type="button" role="radio" aria-checked={michelin === m} aria-label={aria}
                  className={`${styles.segBtn} ${styles.michBtn}`} onClick={() => setMichelin(m)}>
                  {label}
                </button>
              ))}
            </div>
          ))}
        </div>
        {michelin && <label className={styles.inline}>Year <input inputMode="numeric" value={year} onChange={e => setYear(e.target.value)} maxLength={4} /></label>}
      </fieldset>

      <VibeFields className={styles.group} value={vibes} onChange={setVibes} />

      <fieldset className={styles.group}>
        <legend>You</legend>
        <div className={styles.seg} role="radiogroup" aria-label="Your status">
          {(['wtg', 'vis'] as const).map(st => (
            <button key={st} type="button" role="radio" aria-checked={review.status === st} className={styles.segBtn} onClick={() => setReview(r => ({ ...r, status: st }))}>
              <span className={styles.statusDot} style={{ background: st === 'wtg' ? BADGE.wtg.fill : BADGE.revisit.fill }} />
              {st === 'wtg' ? 'WTG' : 'VIS'}
            </button>
          ))}
        </div>
        {review.status === 'vis' && (
          <>
            <div className={styles.seg} role="radiogroup" aria-label="Verdict">
              {VERDICTS.map(({ v, mark, label }) => (
                <button key={v} type="button" role="radio" aria-checked={review.verdict === v} className={styles.segBtn}
                  style={review.verdict === v ? { background: BADGE[v].fill, color: BADGE[v].ink, borderColor: BADGE[v].fill } : undefined}
                  onClick={() => setReview(r => ({ ...r, verdict: v }))}>
                  {mark} {label}
                </button>
              ))}
            </div>
            <Stars value={review.rating} onChange={rating => setReview(r => ({ ...r, rating }))} />
          </>
        )}
        {eatery && avg != null && <p className={styles.avg}>Average {avg.toFixed(1)} of 5 ({rated} rating{rated === 1 ? '' : 's'})</p>}
      </fieldset>

      {eatery ? (
        <Photos eatery={eatery} userId={userId} />
      ) : (
        <p className={styles.path}>Photos can be added once the eatery is saved.</p>
      )}

      <label className={styles.field}>
        Note
        <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} maxLength={4000} />
      </label>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {importActions ? (
        <ImportButtons actions={importActions} busy={busy} classes={{ buttons: styles.buttons, del: styles.del, confirm: styles.confirm }} />
      ) : confirm ? (
        <div className={styles.confirm} role="alert">
          <span>Remove this eatery? It goes to the owner's pending-deletion list.</span>
          <button type="button" className="btn" onClick={remove} disabled={busy}>Remove</button>
          <button type="button" className="btn btn-quiet" onClick={() => setConfirm(false)}>Keep</button>
        </div>
      ) : (
        <div className={styles.buttons}>
          {eatery && <button type="button" className={`btn btn-quiet ${styles.del}`} onClick={() => setConfirm(true)}>Remove…</button>}
          <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving…' : eatery ? 'Save' : 'Add eatery'}</button>
        </div>
      )}
    </form>
  )
}

function Photos({ eatery, userId }: { eatery: Eatery; userId: string }) {
  const [photos, setPhotos] = useState<EateryPhoto[]>([])
  const [google, setGoogle] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    fetchEateryPhotos([eatery.id]).then(p => alive && setPhotos(p)).catch(() => {})
    if (eatery.google_place_id) googlePhotoUrl(eatery.google_place_id).then(u => alive && setGoogle(u)).catch(() => {})
    return () => { alive = false }
  }, [eatery.id, eatery.google_place_id])

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setErr('')
    try {
      const row = await addEateryPhoto(eatery.id, userId, file, photos.length)
      setPhotos(p => [...p, row])
    } catch (e) {
      setErr(`Couldn't upload: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }
  async function drop(photo: EateryPhoto) {
    setBusy(true)
    try {
      await removeEateryPhoto(photo)
      setPhotos(p => p.filter(x => x.id !== photo.id))
    } catch (e) {
      setErr(`Couldn't remove: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <fieldset className={styles.group}>
      <legend>Photos</legend>
      <div className={styles.thumbs}>
        {photos.map((p, i) => (
          <div key={p.id} className={styles.thumb} style={{ backgroundImage: `url(${photoUrl(p.path)})` }}>
            {i === 0 && <span className={styles.cover}>Cover</span>}
            <button type="button" className={styles.rm} aria-label="Remove photo" disabled={busy} onClick={() => drop(p)}>×</button>
          </div>
        ))}
        {photos.length === 0 && google && (
          <div className={styles.thumb} style={{ backgroundImage: `url(${google})` }}><span className={styles.cover}>From Google</span></div>
        )}
        {photos.length === 0 && !google && <div className={`${styles.thumb} ${styles.placeholder}`}>Photo coming soon</div>}
        {photos.length < MAX_PHOTOS && (
          <label className={styles.addTile}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            Add photo
            <input type="file" accept="image/*" hidden disabled={busy} onChange={e => onFile(e.target.files?.[0])} />
          </label>
        )}
      </div>
      <span className={styles.hintNote}>Up to {MAX_PHOTOS}, shared on the eatery. The first is the cover; with none, a Google photo is used.</span>
      {err && <p className={styles.error} role="alert">{err}</p>}
    </fieldset>
  )
}

function Stars({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const v = value ?? 0
  return (
    <div className={styles.starsRow}>
      <div className={styles.stars} role="slider" tabIndex={0} aria-label="Your rating" aria-valuemin={0} aria-valuemax={5} aria-valuenow={v} aria-valuetext={value ? `${value} of 5` : 'No rating'}
        onKeyDown={e => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(Math.min(5, Math.max(1, v + 0.5)))
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(v <= 1 ? null : v - 0.5)
          else return
          e.preventDefault()
        }}>
        {[1, 2, 3, 4, 5].map(i => {
          const fill = v >= i ? 1 : v >= i - 0.5 ? 0.5 : 0
          return (
            <span key={i} className={styles.star}>
              {i > 1 && <button type="button" tabIndex={-1} className={styles.halfL} aria-label={`${i - 0.5} stars`} onClick={() => onChange(i - 0.5)} />}
              <button type="button" tabIndex={-1} className={i > 1 ? styles.halfR : styles.whole} aria-label={`${i} star${i === 1 ? '' : 's'}`} onClick={() => onChange(i)} />
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                <defs><clipPath id={`esh-${i}`}><rect x="0" y="0" width={12} height="24" /></clipPath></defs>
                <path d={STAR} fill="none" stroke="#C9A24A" strokeWidth="1.4" />
                {fill > 0 && <path d={STAR} fill="#E8A33A" clipPath={fill === 0.5 ? `url(#esh-${i})` : undefined} />}
              </svg>
            </span>
          )
        })}
      </div>
      <span className={styles.hintNote}>{value ? `${value.toFixed(1)} of 5` : 'No rating'}</span>
      {value != null && <button type="button" className={styles.link} onClick={() => onChange(null)}>Clear</button>}
    </div>
  )
}
const STAR = 'M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z'
