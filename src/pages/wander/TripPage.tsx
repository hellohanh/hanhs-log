import { useCallback, useEffect, useMemo, useState } from 'react'
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
import TripMap, { type CityState, type MapPin } from './TripMap'
import PlacesPanel, { type Editing } from './PlacesPanel'
import { fetchPins, fetchReviews, pinBadge, pinFaded, type Pin, type Review } from '../../lib/pins'
import { pinLook } from '../../lib/pinCatalog'
import { pinBox, pinHtml } from '../../lib/pinDraw'
import ItineraryPanel, { ItineraryOpener, PANEL_WIDTH } from './ItineraryPanel'
import { readPanelState, savePanelState, type PanelState } from '../../lib/itinerary'
import { ensureTripCity, type City } from '../../lib/city'
import TripForm from './TripForm'
import styles from './TripPage.module.css'

// The trip page (/wander/trip/:id), from the approved M3 mockup: the trip
// bar (title, dates, people, Edit trip, Share & people) over Places (left),
// the map, and the itinerary panel (right; session 4 moved the itinerary
// out of its own tab). Pins (step 4): added from the Places panel's search
// box and drawn on the map; the full pin list tree is step 5.

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

  // Pins and everyone's WTG / VIS. "Show all pins" and the MICHELIN filter
  // start fresh on every visit (Hanh, session 4).
  const [pins, setPins] = useState<Pin[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [pinsError, setPinsError] = useState('')
  const [showAll, setShowAll] = useState(true)
  const [michelinOnly, setMichelinOnly] = useState(false)
  const [pinEdit, setPinEdit] = useState<Editing>(null)
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null)
  // Itinerary ↔ Places: the open day (for "Add to day"), a request to schedule
  // a pin on it, and OTD Pins (the day's pin ids to keep bright on the map).
  const [openDay, setOpenDay] = useState<{ id: string; label: string } | null>(null)
  const [addReq, setAddReq] = useState<{ pinId: string; n: number } | null>(null)
  const [otdPinIds, setOtdPinIds] = useState<string[] | null>(null)
  const loadPins = useCallback(async () => {
    try {
      const ps = await fetchPins(tripId)
      setPins(ps)
      setReviews(await fetchReviews(ps.map(p => p.id)))
      setPinsError('')
    } catch (e) {
      setPinsError((e as Error).message)
    }
  }, [tripId])
  useEffect(() => {
    loadPins()
  }, [loadPins])
  // OTD Pins (itinerary open, toggle on) overrides Show all pins and the
  // MICHELIN filter: the day's pins stay bright, the rest fade (Hanh, session 4).
  const otdActive = panel.open && otdPinIds !== null
  const otdSet = useMemo(() => new Set(otdPinIds ?? []), [otdPinIds])
  const mapPins = useMemo<MapPin[]>(
    () =>
      pins.map(p => {
        const look = pinLook(p)
        const box = pinBox(p)
        const editingThis = pinEdit?.mode === 'edit' && pinEdit.pinId === p.id
        const faded = pinFaded(p, { editing: editingThis, otdPins: otdActive ? otdSet : null, showAll, michelinOnly })
        return {
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          title: `${p.name} (${look.label})`,
          html: pinHtml({ color: look.color, icon: look.icon, michelin: p.michelin, badge: pinBadge(reviews.filter(r => r.pin_id === p.id)) }),
          width: box.width,
          height: box.height,
          faded
        }
      }),
    [pins, reviews, showAll, michelinOnly, pinEdit, otdActive, otdSet]
  )

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
        <PlacesPanel
          tripId={trip.id}
          userId={userId}
          people={people}
          pins={pins}
          reviews={reviews}
          loadError={pinsError}
          showAll={showAll}
          onShowAll={setShowAll}
          michelinOnly={michelinOnly}
          onMichelinOnly={setMichelinOnly}
          editing={pinEdit}
          onEditing={setPinEdit}
          onSaved={() => loadPins()}
          onFocus={at => setFocus({ lat: at.lat, lng: at.lng })}
          near={city.state === 'ready' ? { lat: city.city.lat, lng: city.city.lng } : undefined}
          openDay={panel.open ? openDay : null}
          onAddToDay={pinId => setAddReq(r => ({ pinId, n: (r?.n ?? 0) + 1 }))}
        />
        <div className={styles.mapArea}>
          <TripMap
            city={city}
            rightInset={panel.open ? (panel.wide ? 2 : 1) * PANEL_WIDTH : 0}
            pins={mapPins}
            focus={focus}
            onPinClick={id => setPinEdit({ mode: 'edit', pinId: id })}
          />
          {panel.open ? (
            <ItineraryPanel
              tripId={trip.id}
              start={trip.start_date}
              end={trip.end_date}
              wide={panel.wide}
              home={city.state === 'ready' ? { center: { lat: city.city.lat, lng: city.city.lng }, zoom: 13 } : { center: { lat: 20, lng: 0 }, zoom: 2 }}
              pins={pins}
              reviews={reviews}
              addRequest={addReq}
              onWide={() => setPanel(p => ({ ...p, wide: !p.wide }))}
              onClose={() => setPanel(p => ({ ...p, open: false }))}
              onOpenDay={setOpenDay}
              onOtdPins={setOtdPinIds}
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
