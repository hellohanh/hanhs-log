import { useState, type FormEvent } from 'react'
import { CATEGORIES, categoryOf, pinLook } from '../../lib/pinCatalog'
import { BADGE, pinHtml, type Michelin } from '../../lib/pinDraw'
import { MICHELIN_ROWS, noVibes, vibesOf, type Vibes } from '../../lib/vibe'
import VibeFields from '../../components/VibeFields'
import { averageRating, deletePin, pinBadge, saveMyReview, savePin, type FoundPlace, type MyReview, type Pin, type PinFields, type Review, type Verdict } from '../../lib/pins'
import type { Person } from '../../lib/trips'
import styles from './Places.module.css'
import NameFields from '../../components/NameFields'
import { joinName, splitName } from '../../lib/placeName'
import type { ImportPrefill } from '../../lib/pinImport'
import ImportButtons, { type ImportActions } from '../../components/ImportButtons'

// The add / edit card (approved inline mockups, session 4): the place from
// Google, its category picked by hand, your WTG / VIS (VIS needs a verdict;
// a 1–5 rating in half stars), MICHELIN (None / Selected / Bib, then the
// stars) and the Vibe ticks for food and drink (session 14), and a note. Editing also lists everyone's
// status and the average rating (shown here only, never on the pin).

const VERDICTS: { v: Verdict; mark: string; label: string }[] = [
  { v: 'revisit', mark: '✓', label: 'Revisit' },
  { v: 'second', mark: '–', label: '2nd chance' },
  { v: 'no', mark: '✗', label: "Don't go back" }
]

export default function PinForm({
  tripId,
  userId,
  people,
  place,
  pin,
  reviews,
  openDay,
  onAddToDay,
  onFood,
  onCancel,
  onSaved,
  prefill,
  importActions
}: {
  tripId: string
  userId: string
  people: Person[]
  place?: FoundPlace
  pin?: Pin
  reviews: Review[]
  openDay: { id: string; label: string } | null
  onAddToDay: (id: string, kind: 'pin') => void
  /** Picking the Nom-Nom category hands off to the Savorlog add panel (M5). */
  onFood?: () => void
  onCancel: () => void
  onSaved: (pinId: string) => void
  /** Values Claude prepared for an old Wanderlog pin (E71). */
  prefill?: ImportPrefill
  /** The import queue's Skip for good / Back / Save and next (E71). */
  importActions?: ImportActions
}) {
  const mine = reviews.find(r => r.user_id === userId)
  const [names, setNames] = useState(() =>
    prefill && !pin ? { en: prefill.name_en ?? '', local: prefill.name_local ?? '' } : splitName(pin?.name ?? place?.name)
  )
  const name = joinName(names.en, names.local)
  const [category, setCategory] = useState(pin?.category ?? prefill?.category ?? '')
  const [sub, setSub] = useState(pin?.subcategory ?? prefill?.sub ?? '')
  const [leaf, setLeaf] = useState(pin?.subsubcategory ?? prefill?.leaf ?? '')
  const [review, setReview] = useState<MyReview>({ status: mine?.status ?? 'wtg', verdict: mine?.verdict ?? null, rating: mine?.rating ?? null })
  const [michelin, setMichelin] = useState<Michelin>(pin?.michelin ?? prefill?.michelin ?? null)
  const [year, setYear] = useState(String(pin?.michelin_year ?? prefill?.michelin_year ?? new Date().getFullYear()))
  const [vibes, setVibes] = useState<Vibes>(() => vibesOf(pin ?? prefill))
  const [note, setNote] = useState(pin?.note ?? prefill?.note ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const cat = categoryOf(category)
  const subObj = cat?.subs.find(s => s.key === sub)
  const isFood = category === 'food'
  const address = pin?.address ?? place?.address ?? null
  const look = pinLook({ category: category || 'attraction', subcategory: sub || null, subsubcategory: leaf || null })
  // The pin as it will look once saved: your status counts as the newest.
  const changedMine = !mine || mine.status !== review.status || mine.verdict !== review.verdict
  const asSaved: Review[] = [
    ...reviews.filter(r => r.user_id !== userId),
    { pin_id: '', user_id: userId, ...review, updated_at: changedMine ? '9999' : mine.updated_at }
  ]
  const preview = pinHtml({ color: look.color, icon: look.art ?? look.icon, michelin: isFood ? michelin : null, badge: pinBadge(asSaved) })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Give the place a name.')
    if (!cat) return setError('Pick a category.')
    if (review.status === 'vis' && !review.verdict) return setError('Pick ✓, – or ✗ to save it as VIS.')
    const y = Number(year)
    if (isFood && michelin && (!Number.isInteger(y) || y < 1900 || y > 2100)) return setError('Give the MICHELIN year, like 2026.')
    const fields: PinFields = {
      trip_id: tripId,
      google_place_id: pin?.google_place_id ?? place?.id ?? null,
      name,
      address,
      lat: pin?.lat ?? place!.lat,
      lng: pin?.lng ?? place!.lng,
      category,
      subcategory: sub || null,
      subsubcategory: leaf || null,
      michelin: isFood ? michelin : null,
      michelin_year: isFood && michelin ? y : null,
      ...(isFood ? vibes : noVibes()),
      note: note.trim() || null
    }
    setBusy(true)
    setError('')
    try {
      const id = await savePin(fields, pin?.id)
      const changed = !mine || mine.status !== review.status || mine.verdict !== review.verdict || mine.rating !== review.rating
      if (changed) await saveMyReview(id, userId, review)
      onSaved(id)
    } catch (err) {
      setError(`Couldn't save: ${(err as Error).message}`)
      setBusy(false)
    }
  }

  async function remove() {
    if (!pin) return
    setBusy(true)
    try {
      await deletePin(pin.id)
      onSaved('')
    } catch (err) {
      setError(`Couldn't delete: ${(err as Error).message}`)
      setBusy(false)
    }
  }

  const rated = reviews.filter(r => r.rating != null).length
  const avg = averageRating(reviews)
  const nameOf = (id: string) => people.find(p => p.user_id === id)?.display_name ?? 'Someone'

  return (
    <form className={styles.card} onSubmit={submit} noValidate aria-label={pin ? 'Edit place' : 'Add a place'}>
      <div className={styles.cardHead}>
        <strong>{pin ? 'Edit place' : 'Add a place'}</strong>
        <span className={styles.preview} dangerouslySetInnerHTML={{ __html: preview }} aria-hidden="true" />
        <button type="button" className={styles.x} aria-label="Close" onClick={onCancel}>×</button>
      </div>

      <NameFields value={names} onChange={setNames} fieldClass={styles.field} hintClass={styles.address} />
      {address && <p className={styles.address}>{address}</p>}

      {pin && (
        <button
          type="button"
          className={styles.addToDay}
          disabled={!openDay}
          onClick={() => openDay && onAddToDay(pin.id, 'pin')}
          title={openDay ? `Add to ${openDay.label}` : 'Add to a day — open the itinerary first'}
        >
          + {openDay ? `Add to ${openDay.label}` : 'Add to a day — open the itinerary first'}
        </button>
      )}

      <fieldset className={styles.group}>
        <legend>Category</legend>
        <select
          aria-label="Category"
          value={category}
          onChange={e => {
            // Dining lives in Savorlog now: picking Nom-Nom hands off to its
            // add panel instead of making a trip pin (M5).
            if (e.target.value === 'food' && onFood) return onFood()
            setCategory(e.target.value)
            setSub('')
            setLeaf('')
          }}
        >
          <option value="">Pick a category</option>
          {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        {cat && cat.subs.length > 0 && (
          <select aria-label={cat.subLabel ?? 'Type'} value={sub} onChange={e => { setSub(e.target.value); setLeaf('') }}>
            <option value="">{cat.subLabel ?? 'Type'} (optional)</option>
            {cat.subs.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        )}
        {subObj?.leaves && (
          <select aria-label={cat?.leafLabel ?? 'Type'} value={leaf} onChange={e => setLeaf(e.target.value)}>
            <option value="">{cat?.leafLabel ?? 'Type'} (optional)</option>
            {subObj.leaves.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
        )}
      </fieldset>

      <fieldset className={styles.group}>
        <legend>You</legend>
        <div className={styles.seg} role="radiogroup" aria-label="Your status">
          {(['wtg', 'vis'] as const).map(st => (
            <button
              key={st}
              type="button"
              role="radio"
              aria-checked={review.status === st}
              className={styles.segBtn}
              onClick={() => setReview(r => ({ ...r, status: st }))}
            >
              <span className={styles.status} style={{ background: st === 'wtg' ? BADGE.wtg.fill : BADGE.revisit.fill }} />
              {st === 'wtg' ? 'WTG' : 'VIS'}
            </button>
          ))}
        </div>
        {review.status === 'vis' && (
          <>
            <div className={styles.seg} role="radiogroup" aria-label="Verdict">
              {VERDICTS.map(({ v, mark, label }) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={review.verdict === v}
                  className={styles.segBtn}
                  style={review.verdict === v ? { background: BADGE[v].fill, color: BADGE[v].ink, borderColor: BADGE[v].fill } : undefined}
                  onClick={() => setReview(r => ({ ...r, verdict: v }))}
                >
                  {mark} {label}
                </button>
              ))}
            </div>
            <Stars value={review.rating} onChange={rating => setReview(r => ({ ...r, rating }))} />
          </>
        )}
      </fieldset>

      {pin && reviews.length > 0 && (
        <fieldset className={styles.group}>
          <legend>Everyone on the trip</legend>
          <ul className={styles.everyone}>
            {reviews.map(r => (
              <li key={r.user_id}>
                <span className={styles.status} style={{ background: BADGE[r.status === 'vis' && r.verdict ? r.verdict : 'wtg'].fill }} />
                <span className={styles.name}>{r.user_id === userId ? 'You' : nameOf(r.user_id)}</span>
                <span className={styles.muted0}>{r.status === 'vis' ? `VIS · ${VERDICTS.find(x => x.v === r.verdict)?.label ?? ''}` : 'WTG'}</span>
                {r.rating != null && <span className={styles.muted0}>{r.rating.toFixed(1)}★</span>}
              </li>
            ))}
          </ul>
          {avg != null && <p className={styles.avg}>Average {avg.toFixed(1)} of 5 ({rated} rating{rated === 1 ? '' : 's'})</p>}
          <p className={styles.muted0}>The pin shows: {BADGE[pinBadge(reviews)].label}</p>
        </fieldset>
      )}

      {isFood && (
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
          {michelin && (
            <label className={styles.inline}>
              Year <input inputMode="numeric" value={year} onChange={e => setYear(e.target.value)} maxLength={4} />
            </label>
          )}
        </fieldset>
      )}

      {isFood && (
        <VibeFields className={styles.group} value={vibes} onChange={setVibes} />
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
          <span>Delete this place for everyone on the trip?</span>
          <button type="button" className="btn" onClick={remove} disabled={busy}>Delete</button>
          <button type="button" className="btn btn-quiet" onClick={() => setConfirm(false)}>Keep</button>
        </div>
      ) : (
        <div className={styles.buttons}>
          {pin && <button type="button" className={`btn btn-quiet ${styles.del}`} onClick={() => setConfirm(true)}>Delete</button>}
          <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving…' : pin ? 'Save' : 'Add pin'}</button>
        </div>
      )}
    </form>
  )
}

/** 1–5 stars in halves: the left half of a star gives a half. Arrow keys work too. */
function Stars({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const v = value ?? 0
  return (
    <div className={styles.starsRow}>
      <div
        className={styles.stars}
        role="slider"
        tabIndex={0}
        aria-label="Your rating"
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={v}
        aria-valuetext={value ? `${value} of 5` : 'No rating'}
        onKeyDown={e => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(Math.min(5, Math.max(1, v + 0.5)))
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(v <= 1 ? null : v - 0.5)
          else return
          e.preventDefault()
        }}
      >
        {[1, 2, 3, 4, 5].map(i => {
          const fill = v >= i ? 1 : v >= i - 0.5 ? 0.5 : 0
          return (
            <span key={i} className={styles.star}>
              {i > 1 && <button type="button" tabIndex={-1} className={styles.halfL} aria-label={`${i - 0.5} stars`} onClick={() => onChange(i - 0.5)} />}
              <button type="button" tabIndex={-1} className={i > 1 ? styles.halfR : styles.whole} aria-label={`${i} star${i === 1 ? '' : 's'}`} onClick={() => onChange(i)} />
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                <defs>
                  <clipPath id={`half-${i}`}><rect x="0" y="0" width={12} height="24" /></clipPath>
                </defs>
                <path d={STAR} fill="none" stroke="#C9A24A" strokeWidth="1.4" />
                {fill > 0 && <path d={STAR} fill="#E8A33A" clipPath={fill === 0.5 ? `url(#half-${i})` : undefined} />}
              </svg>
            </span>
          )
        })}
      </div>
      <span className={styles.muted0}>{value ? `${value.toFixed(1)} of 5` : 'No rating'}</span>
      {value != null && <button type="button" className={styles.link} onClick={() => onChange(null)}>Clear</button>}
    </div>
  )
}

const STAR = 'M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z'
