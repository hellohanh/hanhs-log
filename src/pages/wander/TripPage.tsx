import { useCallback, useEffect, useState } from 'react'
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
  mapQuery,
  placeLabel,
  type Person,
  type Trip,
  type TripPlace
} from '../../lib/trips'
import ShareDialog from './ShareDialog'
import NamePrompt from './NamePrompt'
import TripMap, { type CityState } from './TripMap'
import ItineraryPanel, { ItineraryOpener, PANEL_WIDTH } from './ItineraryPanel'
import { readPanelState, savePanelState, type PanelState } from '../../lib/itinerary'
import { ensureTripCity, type City } from '../../lib/city'
import TripForm from './TripForm'
import styles from './TripPage.module.css'

// The trip page (/wander/trip/:id), from the approved M3 mockup: the trip
// bar (title, dates, people, Edit trip, Share & people) over Places (left),
// the map, and the itinerary panel (right; session 4 moved the itinerary
// out of its own tab). Adding pins is step 4; the pin list step 5.

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
  const [city, setCity] = useState<CityState>({ state: 'loading' })
  // Itinerary panel: closed by default; open/closed and width remembered on this device.
  const [panel, setPanelState] = useState<PanelState>(readPanelState)
  const setPanel = (f: (p: PanelState) => PanelState) =>
    setPanelState(p => {
      const next = f(p)
      savePanelState(next)
      return next
    })

  // Where the map opens: the Primary City in its Country, saved on the trip
  // and looked up again only when either changes.
  const loadCity = useCallback((place: TripPlace) => {
    ensureTripCity(tripId, place).then(
      c => setCity(c ? { state: 'ready', city: c } : { state: 'missing', query: mapQuery(place) }),
      e => setCity({ state: 'error', message: (e as Error).message })
    )
  }, [tripId])

  const loadPeople = useCallback(() => fetchPeople(tripId).then(setPeople, () => setPeople([])), [tripId])

  useEffect(() => {
    fetchTrip(tripId).then(
      trip => {
        setLoad(trip ? { state: 'ready', trip } : { state: 'missing' })
        if (trip) loadCity(trip)
      },
      e => setLoad({ state: 'error', message: (e as Error).message })
    )
    loadPeople()
    // If names can't be checked (e.g. before the database update), don't nag.
    fetchMyName(userId).then(setMyName, () => setMyName(undefined))
  }, [tripId, userId, loadPeople, loadCity])

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
            <span className={styles.meta}>{placeLabel(trip)} · {dates}</span>
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
          onSaved={(t, found) => {
            setLoad({ state: 'ready', trip: t })
            setEditing(false)
            if (found) setCity({ state: 'ready', city: found })
            else if (mapQuery(t) !== mapQuery(trip)) loadCity(t)
          }}
        />
      )}

      <div className={styles.body}>
        <aside className={styles.side} aria-label="Places">
          <p className={styles.placeholderTitle}>Places</p>
          <p className={styles.placeholderText}>No places on this trip yet.</p>
          <p className={styles.placeholderText}>Old Wanderlog pins show here and on the map once you sort them. Adding pins comes in step 4.</p>
        </aside>
        <div className={styles.mapArea}>
          <TripMap city={city} rightInset={panel.open ? (panel.wide ? 2 : 1) * PANEL_WIDTH : 0} />
          {panel.open ? (
            <ItineraryPanel
              tripId={trip.id}
              start={trip.start_date}
              end={trip.end_date}
              wide={panel.wide}
              home={city.state === 'ready' ? { center: { lat: city.city.lat, lng: city.city.lng }, zoom: 13 } : { center: { lat: 20, lng: 0 }, zoom: 2 }}
              onWide={() => setPanel(p => ({ ...p, wide: !p.wide }))}
              onClose={() => setPanel(p => ({ ...p, open: false }))}
            />
          ) : (
            <ItineraryOpener onOpen={() => setPanel(p => ({ ...p, open: true }))} />
          )}
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

function EditTrip({ trip, onCancel, onSaved }: { trip: Trip; onCancel: () => void; onSaved: (t: Trip, found?: City) => void }) {
  return (
    <div className={styles.edit}>
      <TripForm
        title="Edit trip"
        initial={trip}
        submitLabel="Save"
        busyLabel="Saving…"
        onCancel={onCancel}
        onSubmit={async (fields, map) => {
          await updateTrip(trip.id, fields, map)
          const found: City | undefined = map && map.map_query && map.map_lat != null && map.map_lng != null
            ? { query: map.map_query, label: map.map_label, lat: map.map_lat, lng: map.map_lng, north: map.map_north, south: map.map_south, east: map.map_east, west: map.map_west }
            : undefined
          onSaved({ ...trip, ...fields }, found)
        }}
      />
    </div>
  )
}
