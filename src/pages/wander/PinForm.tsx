import { useState, type FormEvent } from 'react'
import { CATEGORIES, categoryOf, pinLook } from '../../lib/pinCatalog'
import { BADGE, flowerSvg, pinHtml, type Michelin } from '../../lib/pinDraw'
import { averageRating, deletePin, pinBadge, saveMyReview, savePin, type FoundPlace, type MyReview, type Pin, type PinFields, type Review, type Verdict } from '../../lib/pins'
import type { Person } from '../../lib/trips'
import styles from './Places.module.css'

// The add / edit card (approved inline mockups, session 4): the place from
// Google, its category picked by hand, your WTG / VIS (VIS needs a verdict;
// a 1–5 rating in half stars), MICHELIN and the Street food / Fine dining
// badges for food and drink, and a note. Editing also lists everyone's
// status and the average rating (shown here only, never on the pin).

const VERDICTS: { v: Verdict; mark: string; label: string }[] = [
  { v: 'revisit', mark: '✓', label: 'Revisit' },
  { v: 'second', mark: '–', label: '2nd chance' },
  { v: 'no', mark: '✗', label: "Don't go back" }
]
const MICHELIN: { m: Michelin; label: string }[] = [
  { m: null, label: 'None' },
  { m: 'mentioned', label: 'Mentioned' },
  { m: '1', label: '★' },
  { m: '2', label: '★★' },
  { m: '3', label: '★★★' }
]

export default function PinForm({
  tripId,
  userId,
  people,
  place,
  pin,
  reviews,
  onCancel,
  onSaved
}: {
  tripId: string
  userId: string
  people: Person[]
  place?: FoundPlace
  pin?: Pin
  reviews: Review[]
  onCancel: () => void
  onSaved: (pinId: string) => void
}) {
  const mine = reviews.find(r => r.user_id === userId)
  const [name, setName] = useState(pin?.name ?? place?.name ?? '')
  const [category, setCategory] = useState(pin?.category ?? '')
  const [sub, setSub] = useState(pin?.subcategory ?? '')
  const [leaf, setLeaf] = useState(pin?.subsubcategory ?? '')
  const [review, setReview] = useState<MyReview>({ status: mine?.status ?? 'wtg', verdict: mine?.verdict ?? null, rating: mine?.rating ?? null })
  const [michelin, setMichelin] = useState<Michelin>(pin?.michelin ?? null)
  const [year, setYear] = useState(pin?.michelin_year ? String(pin.michelin_year) : String(new Date().getFullYear()))
  const [streetFood, setStreetFood] = useState(pin?.street_food ?? false)
  const [fineDining, setFineDining] = useState(pin?.fine_dining ?? false)
  const [note, setNote] = useState(pin?.note ?? '')
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
  const preview = pinHtml({ color: look.color, icon: look.icon, michelin: isFood ? michelin : null, badge: pinBadge(asSaved) })

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
      name: name.trim(),
      address,
      lat: pin?.lat ?? place!.lat,
      lng: pin?.lng ?? place!.lng,
      category,
      subcategory: sub || null,
      subsubcategory: leaf || null,
      michelin: isFood ? michelin : null,
      michelin_year: isFood && michelin ? y : null,
      street_food: isFood && streetFood,
      fine_dining: isFood && fineDining,
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

      <label className={styles.field}>
        Name
        <input value={name} onChange={e => setName(e.target.value)} maxLength={200} />
      </label>
      {address && <p className={styles.address}>{address}</p>}

      <fieldset className={styles.group}>
        <legend>Category</legend>
        <select aria-label="Category" value={category} onChange={e => { setCategory(e.target.value); setSub(''); setLeaf('') }}>
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
          <div className={styles.seg} role="radiogroup" aria-label="MICHELIN">
            {MICHELIN.map(({ m, label }) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={michelin === m}
                aria-label={m === null ? 'None' : m === 'mentioned' ? 'Mentioned' : `${m} star${m === '1' ? '' : 's'}`}
                className={`${styles.segBtn} ${styles.michBtn}`}
                onClick={() => setMichelin(m)}
              >
                {m === 'mentioned' && <span dangerouslySetInnerHTML={{ __html: flowerSvg(14, '#9E2A2B') }} />}
                {label}
              </button>
            ))}
          </div>
          {michelin && (
            <label className={styles.inline}>
              Year <input inputMode="numeric" value={year} onChange={e => setYear(e.target.value)} maxLength={4} />
            </label>
          )}
          <div className={styles.seg}>
            <label className={styles.check}><input type="checkbox" checked={streetFood} onChange={e => setStreetFood(e.target.checked)} /> Street food</label>
            <label className={styles.check}><input type="checkbox" checked={fineDining} onChange={e => setFineDining(e.target.checked)} /> Fine dining</label>
          </div>
        </fieldset>
      )}

      <label className={styles.field}>
        Note
        <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} maxLength={4000} />
      </label>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {confirm ? (
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
