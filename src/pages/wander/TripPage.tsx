import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { isSupabaseConfigured } from '../../lib/supabase'
import {
  AVATAR_COLORS,
  fetchMyName,
  fetchPeople,
  fetchTrip,
  initials,
  todayISO,
  tripDates,
  updateTrip,
  type Person,
  type Trip
} from '../../lib/trips'
import ShareDialog from './ShareDialog'
import NamePrompt from './NamePrompt'
import styles from './TripPage.module.css'

// The trip page (/wander/trip/:id), from the approved M3 mockup: the trip
// bar (title, dates, people, Edit trip, Share & people) over the map area.
// The map itself arrives in step 3; the pin list in steps 4–5.

export default function TripPage() {
  const { tripId = '' } = useParams()
  const { session, loading } = useAuth()

  if (!isSupabaseConfigured) return <Message text="Sign-in isn't set up in this build, so trips can't be shown." />
  if (loading) return <Message text="Loading…" />
  if (!session) {
    return (
      <Message text="Sign in to open this trip.">
        <Link to="/signin" className="btn" style={{ marginTop: 24 }}>Sign in</Link>
      </Message>
    )
  }
  return <TripLoaded key={tripId} tripId={tripId} userId={session.user.id} />
}

function Message({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <main className="page segoe">
      <p className="eyebrow">Wanderlog</p>
      <h1 style={{ fontSize: 48, margin: '12px 0 16px' }}>Trip</h1>
      <p className="lede" role="status">{text}</p>
      {children}
      <p style={{ marginTop: 24 }}><Link to="/wander">← Your trips</Link></p>
    </main>
  )
}

type Load = { state: 'loading' } | { state: 'ready'; trip: Trip } | { state: 'missing' } | { state: 'error'; message: string }

function TripLoaded({ tripId, userId }: { tripId: string; userId: string }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [people, setPeople] = useState<Person[]>([])
  const [myName, setMyName] = useState<string | null | undefined>(undefined)
  const [nameLater, setNameLater] = useState(false)
  const [editing, setEditing] = useState(false)
  const [sharing, setSharing] = useState(false)

  const loadPeople = useCallback(() => fetchPeople(tripId).then(setPeople, () => setPeople([])), [tripId])

  useEffect(() => {
    fetchTrip(tripId).then(
      trip => setLoad(trip ? { state: 'ready', trip } : { state: 'missing' }),
      e => setLoad({ state: 'error', message: (e as Error).message })
    )
    loadPeople()
    // If names can't be checked (e.g. before the database update), don't nag.
    fetchMyName(userId).then(setMyName, () => setMyName(undefined))
  }, [tripId, userId, loadPeople])

  if (load.state === 'loading') return <Message text="Loading the trip…" />
  if (load.state === 'missing') {
    return <Message text="Can't open this trip. You may not be on it, or the link may be wrong." />
  }
  if (load.state === 'error') return <Message text={`Couldn't load the trip: ${load.message}`} />

  const trip = load.trip
  const isOwner = trip.owner_id === userId
  const dates = tripDates(trip.start_date, trip.end_date, todayISO())
  const shown = people.slice(0, 3)
  const extra = people.length - shown.length

  return (
    <main className={`segoe ${styles.page}`}>
      <section className={styles.bar} aria-label="Trip">
        <div className={styles.titles}>
          <Link to="/wander" className={styles.back}>← Your trips</Link>
          <div className={styles.titleRow}>
            <h1 className={styles.h1}>{trip.name}</h1>
            <span className={styles.meta}>{trip.destination} · {dates}</span>
          </div>
          <div role="tablist" aria-label="Trip views" className={styles.tabs}>
            <button type="button" role="tab" aria-selected="true" className={`${styles.tab} ${styles.tabOn}`}>Map</button>
            <button type="button" role="tab" aria-selected="false" disabled className={styles.tab}>Itinerary · coming in M6</button>
          </div>
        </div>
        <div className={styles.actions}>
          {people.length > 0 && (
            <button
              type="button"
              className={styles.avatars}
              onClick={() => setSharing(true)}
              aria-label={`${people.length} ${people.length === 1 ? 'person' : 'people'} on this trip`}
            >
              {shown.map((p, i) => (
                <span key={p.user_id} className={styles.avatar} style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }} aria-hidden="true">
                  {initials(p.display_name)}
                </span>
              ))}
              {extra > 0 && <span className={`${styles.avatar} ${styles.avatarMore}`} aria-hidden="true">+{extra}</span>}
            </button>
          )}
          <button type="button" className="btn btn-quiet" onClick={() => setEditing(e => !e)} aria-expanded={editing}>
            Edit trip
          </button>
          <button type="button" className="btn" onClick={() => setSharing(true)}>Share &amp; people</button>
        </div>
      </section>

      {editing && (
        <EditTrip
          trip={trip}
          onCancel={() => setEditing(false)}
          onSaved={t => {
            setLoad({ state: 'ready', trip: t })
            setEditing(false)
          }}
        />
      )}

      <div className={styles.body}>
        <aside className={styles.side} aria-label="Places">
          <p className={styles.placeholderTitle}>Places</p>
          <p className={styles.placeholderText}>Search and the pinned list arrive with the map (steps 3–5).</p>
        </aside>
        <div className={styles.map} role="img" aria-label="Map area">
          <p className={styles.placeholderText}>The map arrives in step 3.</p>
        </div>
      </div>

      {sharing && (
        <ShareDialog
          trip={trip}
          people={people}
          isOwner={isOwner}
          myName={myName ?? null}
          userId={userId}
          onTokenChange={token => setLoad({ state: 'ready', trip: { ...trip, invite_token: token } })}
          onPeopleChange={loadPeople}
          onNameChange={name => {
            setMyName(name)
            loadPeople()
          }}
          onClose={() => setSharing(false)}
        />
      )}

      {myName === null && !nameLater && !sharing && (
        <NamePrompt
          userId={userId}
          onSaved={name => {
            setMyName(name)
            loadPeople()
          }}
          onLater={() => setNameLater(true)}
        />
      )}
    </main>
  )
}

function EditTrip({ trip, onCancel, onSaved }: { trip: Trip; onCancel: () => void; onSaved: (t: Trip) => void }) {
  const [name, setName] = useState(trip.name)
  const [destination, setDestination] = useState(trip.destination)
  const [start, setStart] = useState(trip.start_date ?? '')
  const [end, setEnd] = useState(trip.end_date ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const n = name.trim()
    const d = destination.trim()
    if (!n || !d) return setError('Give the trip a name and a destination.')
    if (start && end && end < start) return setError('The end date is before the start date.')
    setSaving(true)
    setError('')
    const fields = { name: n, destination: d, start_date: start || null, end_date: end || null }
    try {
      await updateTrip(trip.id, fields)
      onSaved({ ...trip, ...fields })
    } catch (err) {
      setError(`Couldn't save: ${(err as Error).message}`)
      setSaving(false)
    }
  }

  return (
    <form className={styles.edit} onSubmit={submit} aria-label="Edit trip" noValidate>
      <label className={styles.field}>
        Trip name
        <input value={name} onChange={e => setName(e.target.value)} autoFocus />
      </label>
      <label className={styles.field}>
        Destination
        <input value={destination} onChange={e => setDestination(e.target.value)} />
      </label>
      <label className={`${styles.field} ${styles.dateField}`}>
        Start (optional)
        <input type="date" value={start} onChange={e => setStart(e.target.value)} />
      </label>
      <label className={`${styles.field} ${styles.dateField}`}>
        End (optional)
        <input type="date" value={end} min={start || undefined} onChange={e => setEnd(e.target.value)} />
      </label>
      <div className={styles.editButtons}>
        <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>
  )
}
