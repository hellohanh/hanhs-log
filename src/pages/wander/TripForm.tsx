import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { hasPlacesKey, lookupCity, toMapFields, type City } from '../../lib/city'
import { countryNames } from '../../lib/cityName'
import { mapQuery, type MapFields, type NewTrip } from '../../lib/trips'
import styles from './TripForm.module.css'

// The trip form (approved mockup, session 4), used by New trip and Edit trip:
// Trip name; Country, Primary / Secondary / Tertiary City (Country and
// Primary required); Start and End (optional). Country suggests names as you
// type. Before saving, the form shows where the map will open (the Primary
// City in that Country, as Google finds it).

type Check = { state: 'idle' } | { state: 'checking' } | { state: 'found'; city: City } | { state: 'missing'; query: string } | { state: 'error' }

export default function TripForm({
  title,
  initial,
  submitLabel,
  busyLabel,
  onSubmit,
  onCancel
}: {
  title?: string
  initial?: Partial<NewTrip>
  submitLabel: string
  busyLabel: string
  onSubmit: (trip: NewTrip, map?: MapFields) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [country, setCountry] = useState(initial?.country ?? '')
  const [primary, setPrimary] = useState(initial?.city_primary ?? '')
  const [secondary, setSecondary] = useState(initial?.city_secondary ?? '')
  const [tertiary, setTertiary] = useState(initial?.city_tertiary ?? '')
  const [start, setStart] = useState(initial?.start_date ?? '')
  const [end, setEnd] = useState(initial?.end_date ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [check, setCheck] = useState<Check>({ state: 'idle' })
  const countries = useMemo(countryNames, [])

  // Show where the map will open, a moment after typing stops.
  const query = country.trim() && primary.trim() ? mapQuery({ country, city_primary: primary }) : ''
  useEffect(() => {
    if (!query || !hasPlacesKey) return setCheck({ state: 'idle' })
    let stale = false
    setCheck({ state: 'checking' })
    const t = setTimeout(() => {
      lookupCity(query).then(
        c => !stale && setCheck(c ? { state: 'found', city: c } : { state: 'missing', query }),
        () => !stale && setCheck({ state: 'error' })
      )
    }, 600)
    return () => {
      stale = true
      clearTimeout(t)
    }
  }, [query])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const trip: NewTrip = {
      name: name.trim(),
      country: country.trim(),
      city_primary: primary.trim(),
      city_secondary: secondary.trim() || null,
      city_tertiary: tertiary.trim() || null,
      start_date: start || null,
      end_date: end || null
    }
    if (!trip.name) return setError('Give the trip a name.')
    if (!trip.country || !trip.city_primary) return setError('Add a Country and a Primary City.')
    if (trip.start_date && trip.end_date && trip.end_date < trip.start_date) return setError('The end date is before the start date.')
    setSaving(true)
    setError('')
    try {
      const map = check.state === 'found' && check.city.query === mapQuery(trip) ? toMapFields(check.city) : undefined
      await onSubmit(trip, map)
    } catch (err) {
      setError(`Couldn't save: ${(err as Error).message}`)
      setSaving(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} aria-label={title ?? 'Trip'} noValidate>
      {title && <h2 className={styles.title}>{title}</h2>}
      <div className={styles.one}>
        <label className={styles.field}>
          <b>Trip name <span className={styles.req}>*</span></b>
          <input value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="2026 Holiday Trip; Saigon Leg" />
        </label>
      </div>
      <div className={styles.four}>
        <label className={styles.field}>
          <b>Country <span className={styles.req}>*</span></b>
          <input value={country} onChange={e => setCountry(e.target.value)} list="hl-countries" placeholder="Start typing" autoComplete="off" />
          <datalist id="hl-countries">
            {countries.map(c => <option key={c} value={c} />)}
          </datalist>
        </label>
        <label className={`${styles.field} ${styles.primary}`}>
          <b>Primary City <span className={styles.req}>*</span></b>
          <input value={primary} onChange={e => setPrimary(e.target.value)} placeholder="Hồ Chí Minh City" />
          <span className={styles.hint}>The map opens here.</span>
        </label>
        <label className={styles.field}>
          <b>Secondary City</b>
          <input value={secondary} onChange={e => setSecondary(e.target.value)} placeholder="Optional" />
        </label>
        <label className={styles.field}>
          <b>Tertiary City</b>
          <input value={tertiary} onChange={e => setTertiary(e.target.value)} placeholder="Optional" />
        </label>
      </div>
      <div className={styles.check} aria-live="polite">
        {check.state === 'checking' && <span className={styles.checking}>Finding {query} on the map…</span>}
        {check.state === 'found' && <span className={styles.found}>✓ Map opens on: {check.city.label ?? check.city.query}</span>}
        {check.state === 'missing' && <span className={styles.missing}>Couldn't find "{check.query}" on the map. Check the spelling.</span>}
        {check.state === 'error' && <span className={styles.missing}>Couldn't check the city right now. You can still save.</span>}
      </div>
      <div className={styles.two}>
        <label className={styles.field}>
          <b>Start</b>
          <input type="date" value={start} onChange={e => setStart(e.target.value)} />
        </label>
        <label className={styles.field}>
          <b>End</b>
          <input type="date" value={end} min={start || undefined} onChange={e => setEnd(e.target.value)} />
        </label>
      </div>
      <p className={styles.legend}><span className={styles.req}>*</span> Required. Dates are optional.</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.buttons}>
        <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn" disabled={saving}>{saving ? busyLabel : submitLabel}</button>
      </div>
    </form>
  )
}
