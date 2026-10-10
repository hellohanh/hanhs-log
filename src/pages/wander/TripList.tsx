import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { isSupabaseConfigured } from '../../lib/supabase'
import {
  createTrip,
  deleteTrip,
  fetchPeopleCounts,
  fetchTrips,
  splitTrips,
  todayISO,
  tripDates,
  type TripSummary
} from '../../lib/trips'
import styles from './TripList.module.css'

type Load = { state: 'loading' } | { state: 'ready'; trips: TripSummary[] } | { state: 'error'; message: string }

// The Wanderlog trip list (/wander), from the approved M3 mockup: upcoming
// trips first, then past ones faded. Built for a desktop monitor first.
export default function TripList() {
  const { session, loading } = useAuth()

  if (!isSupabaseConfigured) {
    return (
      <Shell>
        <p className="lede">Sign-in isn't set up in this build, so trips can't be shown.</p>
      </Shell>
    )
  }
  if (loading) {
    return (
      <Shell>
        <p className="lede" role="status">Loading…</p>
      </Shell>
    )
  }
  if (!session) {
    return (
      <Shell>
        <p className="lede">Sign in to see your trips, including the ones shared with you.</p>
        <Link to="/signin" className="btn" style={{ marginTop: 24 }}>Sign in</Link>
      </Shell>
    )
  }
  return <SignedInList userId={session.user.id} />
}

function Shell({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <main className={`segoe ${styles.page}`}>
      <div className={styles.top}>
        <div className={styles.titles}>
          <p className="eyebrow">Wanderlog</p>
          <h1 className={styles.h1}>Your trips</h1>
        </div>
        {action}
      </div>
      {children}
    </main>
  )
}

function SignedInList({ userId }: { userId: string }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState('')
  const [people, setPeople] = useState<Record<string, number>>({})
  const today = todayISO()

  const reload = useCallback(async () => {
    try {
      setLoad({ state: 'ready', trips: await fetchTrips() })
      // People counts are a nice-to-have: if they can't load, cards still show.
      fetchPeopleCounts().then(setPeople, () => setPeople({}))
    } catch (e) {
      setLoad({ state: 'error', message: (e as Error).message })
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const groups = useMemo(() => (load.state === 'ready' ? splitTrips(load.trips, today) : null), [load, today])

  async function remove(trip: TripSummary) {
    const ok = window.confirm(
      `Delete "${trip.name}" and everything in it — pins, itinerary, flights? This can't be undone.`
    )
    if (!ok) return
    try {
      await deleteTrip(trip.id)
      setNotice(`Deleted "${trip.name}".`)
      await reload()
    } catch (e) {
      setNotice(`Couldn't delete "${trip.name}": ${(e as Error).message}`)
    }
  }

  return (
    <Shell
      action={
        !creating && (
          <button type="button" className={`btn ${styles.newBtn}`} onClick={() => setCreating(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New trip
          </button>
        )
      }
    >
      {creating && (
        <NewTripForm
          userId={userId}
          onCancel={() => setCreating(false)}
          onCreated={async name => {
            setCreating(false)
            setNotice(`Created "${name}".`)
            await reload()
          }}
        />
      )}

      <p className={styles.notice} role="status" aria-live="polite">{notice}</p>

      {load.state === 'loading' && <p className="lede" role="status">Loading your trips…</p>}
      {load.state === 'error' && (
        <p className={styles.error} role="alert">
          Couldn't load your trips: {load.message}{' '}
          <button type="button" className={styles.linkBtn} onClick={() => { setLoad({ state: 'loading' }); reload() }}>
            Try again
          </button>
        </p>
      )}

      {groups && (
        <>
          <h2 className={styles.h2}>Upcoming</h2>
          {groups.upcoming.length === 0 ? (
            <p className="lede">No upcoming trips yet. Start one with New trip.</p>
          ) : (
            <ul className={styles.grid}>
              {groups.upcoming.map(t => (
                <TripCard key={t.id} trip={t} today={today} mine={t.owner_id === userId} people={people[t.id]} onDelete={remove} />
              ))}
            </ul>
          )}

          {groups.past.length > 0 && (
            <>
              <h2 className={`${styles.h2} ${styles.pastTitle}`}>Past</h2>
              <ul className={`${styles.grid} ${styles.past}`}>
                {groups.past.map(t => (
                  <TripCard key={t.id} trip={t} today={today} mine={t.owner_id === userId} people={people[t.id]} onDelete={remove} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Shell>
  )
}

function TripCard({
  trip,
  today,
  mine,
  people,
  onDelete
}: {
  trip: TripSummary
  today: string
  mine: boolean
  people?: number
  onDelete: (t: TripSummary) => void
}) {
  const dates = tripDates(trip.start_date, trip.end_date, today)
  const dated = !!(trip.start_date || trip.end_date)
  return (
    <li className={styles.card} data-testid="trip-card">
      <span className={dated ? styles.dates : `${styles.dates} ${styles.undated}`}>{dates}</span>
      <Link to={`/wander/trip/${trip.id}`} className={styles.name}>{trip.name}</Link>
      <span className={styles.destination}>{trip.destination}</span>
      <span className={styles.foot}>
        <span>
          {trip.pinCount === 1 ? '1 pin' : `${trip.pinCount} pins`}
          {people !== undefined && (people <= 1 ? ' · just you' : ` · ${people} people`)}
        </span>
        <span className={styles.footRight}>
          <span className={styles.badge}>{mine ? 'You own this' : 'Shared with you'}</span>
          {mine && (
            <button type="button" className={styles.delete} aria-label={`Delete ${trip.name}`} onClick={() => onDelete(trip)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
              </svg>
            </button>
          )}
        </span>
      </span>
    </li>
  )
}

function NewTripForm({
  userId,
  onCancel,
  onCreated
}: {
  userId: string
  onCancel: () => void
  onCreated: (name: string) => void
}) {
  const [name, setName] = useState('')
  const [destination, setDestination] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const n = name.trim()
    const d = destination.trim()
    if (!n || !d) {
      setError('Give the trip a name and a destination.')
      return
    }
    if (start && end && end < start) {
      setError('The end date is before the start date.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await createTrip({ name: n, destination: d, start_date: start || null, end_date: end || null }, userId)
      onCreated(n)
    } catch (err) {
      setError(`Couldn't create the trip: ${(err as Error).message}`)
      setSaving(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} aria-labelledby="new-trip-title" noValidate>
      <h2 id="new-trip-title" className={styles.formTitle}>New trip</h2>
      <div className={styles.formRow}>
        <label className={styles.field}>
          Trip name
          <input value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="Christmas in Saigon" />
        </label>
        <label className={styles.field}>
          Destination
          <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="Ho Chi Minh City, Vietnam" />
        </label>
        <label className={`${styles.field} ${styles.dateField}`}>
          Start (optional)
          <input type="date" value={start} onChange={e => setStart(e.target.value)} />
        </label>
        <label className={`${styles.field} ${styles.dateField}`}>
          End (optional)
          <input type="date" value={end} min={start || undefined} onChange={e => setEnd(e.target.value)} />
        </label>
        <div className={styles.formButtons}>
          <button type="submit" className="btn" disabled={saving}>{saving ? 'Creating…' : 'Create trip'}</button>
          <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={saving}>Cancel</button>
        </div>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>
  )
}
