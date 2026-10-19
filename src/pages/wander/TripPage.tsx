import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import CopyPinsDialog from './CopyPinsDialog'
import NamePrompt from './NamePrompt'
import TripMap, { type CityState, type MapPin } from './TripMap'
import PlacesPanel, { type Editing, type EateryEditing } from './PlacesPanel'
import { fetchTripEateries, fetchEateryReviews, asReviews, requestEateryDeletion, saveEateryNote, type Eatery, type EateryReview } from '../../lib/eateries'
import { deletePin, fetchPins, isSpot, fetchReviews, pinBadge, pinFaded, savePinNote, type Pin, type Review } from '../../lib/pins'
import PlacePopup from '../../components/PlacePopup'
import BottomSheet, { type Snap } from '../../components/BottomSheet'
import PhoneMenu from '../../components/PhoneMenu'
import { useIsPhone } from '../../lib/usePhone'
import { useBackStep } from '../../lib/useBackStep'

/** How far above the middle a place sits when its phone card opens, so the card doesn't cover it. */
const PHONE_CARD_LIFT = 170
import { michelinHidden, togglePicks } from '../../lib/pinRules'
import { onScreen, type Bounds } from '../../lib/countryBounds'
import { pinLook } from '../../lib/pinCatalog'
import { vibeLabels } from '../../lib/vibe'
import { pinBox, pinHtml, popupIconHtml } from '../../lib/pinDraw'
import ItineraryPanel, { ItineraryOpener, PANEL_WIDTH } from './ItineraryPanel'
import { readPanelState, savePanelState, type PanelState } from '../../lib/itinerary'
import { ensureTripCity, lookupCity, type City } from '../../lib/city'
import { dayCityName, dayForCity } from '../../lib/dayCity'
import { fetchDays, fetchLegs, fetchLegLinks, fetchLegsByIds, type ItineraryDay, type TravelLeg } from '../../lib/itinerary'
import { type DayCity } from './TripMap'
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
  const [copying, setCopying] = useState(false)
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
  // The eyes on the Places rows (session 10): picks, not remembered.
  const [picked, setPicked] = useState<Set<string>>(new Set())
  // The pin popup (session 10): clicking a pin or a list row opens it; ✎ edits.
  const [popup, setPopup] = useState<{ kind: 'pin' | 'eatery'; id: string } | null>(null)
  const [michelinOnly, setMichelinOnly] = useState(false)
  const [pinEdit, setPinEdit] = useState<Editing>(null)
  const [focus, setFocus] = useState<{ lat: number; lng: number; dy?: number } | null>(null)
  // Phone layout (session 10, approved mockups): map is the screen; Places and
  // Itinerary are bottom sheets picked from the bottom bar. A trip opens on
  // the Itinerary at half height (today during the trip).
  const phone = useIsPhone()
  const [tab, setTab] = useState<'places' | 'itinerary'>('itinerary')
  const [snap, setSnap] = useState<Snap>('half')
  const [routeOn, setRouteOn] = useState(false)
  const [tripMenu, setTripMenu] = useState(false)
  const [lookReq, setLookReq] = useState(0)
  // Itinerary ↔ Places: the open day (for "Add to day"), a request to schedule
  // a pin on it, and OTD Pins (the day's pin ids to keep bright on the map).
  const [openDay, setOpenDay] = useState<{ id: string; label: string } | null>(null)
  const [addReq, setAddReq] = useState<{ id: string; kind: import('../../lib/itinerary').StopKind; n: number } | null>(null)
  const [otdPinIds, setOtdPinIds] = useState<string[] | null>(null)
  const [dayRoute, setDayRoute] = useState<import('../../lib/directions').RouteSeg[] | null>(null)
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

  // The whole Savorlog catalogue (session 13, E101: anyone on the trip sees it
  // all; the map shows every eatery, the Nom-Nom list what's on screen), and
  // the Savorlog add/edit panel reached from the Places panel (M5).
  const [eateries, setEateries] = useState<Eatery[]>([])
  const [eateryReviews, setEateryReviews] = useState<EateryReview[]>([])
  const [eateryEdit, setEateryEdit] = useState<EateryEditing>(null)
  const loadEateries = useCallback(async () => {
    try {
      const es = await fetchTripEateries(tripId)
      setEateries(es)
      setEateryReviews(await fetchEateryReviews(es.map(e => e.id)))
    } catch {
      setEateries([])
      setEateryReviews([])
    }
  }, [tripId])
  useEffect(() => {
    loadEateries()
  }, [loadEateries])
  // What's on the map (session 13): the Nom-Nom list follows it like Munch
  // List. Without a map (no key) the list shows everything.
  const [view, setView] = useState<Bounds | null>(null)
  const hasMapKey = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
  const eateriesInView = useMemo(
    () => onScreen(eateries, view, hasMapKey),
    [eateries, view, hasMapKey]
  )
  // Roaminglog spots are on every trip's map; the Places list shows the
  // trip's own pins plus the spots on screen, like the Nom-Nom list.
  const pinsInView = useMemo(() => {
    const spots = onScreen(pins.filter(p => p.source === 'spot'), view, hasMapKey)
    return [...pins.filter(p => p.source !== 'spot'), ...spots].sort((a, b) => a.name.localeCompare(b.name))
  }, [pins, view, hasMapKey])
  // The day's city (session 13, E102): the open itinerary day (or today during
  // the trip) is in the home city until a travel leg lands somewhere else. The
  // home_pin map button glides there, and Reset goes there too.
  const homeName = load.state === 'ready' ? load.trip.city_primary : ''
  const [dayCity, setDayCity] = useState<DayCity | null>(null)
  const cityCache = useRef(new Map<string, { lat: number; lng: number } | null>())
  // Phones: the Itinerary sheet is always there, so its open day counts.
  const openDayId = phone || panel.open ? openDay?.id ?? null : null
  const resolveDayCity = useCallback(async (): Promise<DayCity | null> => {
    if (city.state !== 'ready' || !homeName) return null
    const home: DayCity = { name: homeName, lat: city.city.lat, lng: city.city.lng }
    try {
      const days = await fetchDays(tripId)
      const legs = await fetchTripLegs(tripId, days)
      const name = dayCityName(dayForCity(days, openDayId), legs, homeName)
      if (name === homeName) return home
      if (!cityCache.current.has(name)) {
        cityCache.current.set(name, await lookupCity(name).then(c => (c ? { lat: c.lat, lng: c.lng } : null), () => null))
      }
      const at = cityCache.current.get(name)
      return at ? { name, ...at } : home
    } catch {
      return home
    }
  }, [city, homeName, tripId, openDayId])
  useEffect(() => {
    let live = true
    resolveDayCity().then(c => { if (live) setDayCity(c) })
    return () => { live = false }
  }, [resolveDayCity])
  const refreshDayCity = useCallback(async () => {
    const c = await resolveDayCity()
    setDayCity(c)
    return c
  }, [resolveDayCity])
  // OTD Pins (itinerary open, toggle on) overrides Show all pins and the
  // MICHELIN filter: the day's pins stay bright, the rest fade (Hanh, session 4);
  // since session 14 the MICHELIN chip hides non-MICHELIN pins (michelinHidden).
  // Day route on: only the day's places stay bright. On the computer that's
  // while the itinerary panel is open; on the phone the itinerary is always
  // there (its sheet) and the route button decides (session 10).
  const otdActive = (phone ? routeOn : panel.open) && otdPinIds !== null
  const otdSet = useMemo(() => new Set(otdPinIds ?? []), [otdPinIds])
  const mapPins = useMemo<MapPin[]>(
    () =>
      pins.filter(p => !michelinHidden(p, { editing: pinEdit?.mode === 'edit' && pinEdit.pinId === p.id, otdPins: otdActive ? otdSet : null, michelinOnly })).map(p => {
        const look = pinLook(p)
        const box = pinBox(p)
        const editingThis = pinEdit?.mode === 'edit' && pinEdit.pinId === p.id
        const faded = pinFaded(p, { editing: editingThis, otdPins: otdActive ? otdSet : null, showAll, michelinOnly, picked })
        return {
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          title: `${p.name} (${look.label})`,
          html: pinHtml({ color: look.color, icon: look.art ?? look.icon, michelin: p.michelin, badge: pinBadge(reviews.filter(r => r.pin_id === p.id)) }),
          width: box.width,
          height: box.height,
          faded,
          keepApart: otdActive && otdSet.has(p.id)
        }
      }),
    [pins, reviews, showAll, michelinOnly, picked, pinEdit, otdActive, otdSet]
  )
  // The trip's catalogue eateries as map pins (same drawing as pins).
  const eateryMapPins = useMemo<MapPin[]>(
    () =>
      eateries.filter(e => !michelinHidden(e, { editing: eateryEdit?.mode === 'edit' && eateryEdit.id === e.id, otdPins: otdActive ? otdSet : null, michelinOnly })).map(e => {
        const look = pinLook({ category: 'food', subcategory: e.cuisine, subsubcategory: e.dish })
        const box = pinBox(e)
        const editingThis = eateryEdit?.mode === 'edit' && eateryEdit.id === e.id
        const faded = pinFaded({ id: e.id, michelin: e.michelin }, { editing: editingThis, otdPins: otdActive ? otdSet : null, showAll, michelinOnly, picked })
        return {
          id: e.id,
          lat: e.lat,
          lng: e.lng,
          title: `${e.name} (${look.label})`,
          html: pinHtml({ color: look.color, icon: look.icon, michelin: e.michelin, badge: pinBadge(asReviews(eateryReviews, e.id)) }),
          width: box.width,
          height: box.height,
          faded,
          keepApart: otdActive && otdSet.has(e.id)
        }
      }),
    [eateries, eateryReviews, showAll, michelinOnly, picked, eateryEdit, otdActive, otdSet]
  )
  const allMapPins = useMemo(() => [...mapPins, ...eateryMapPins], [mapPins, eateryMapPins])

  const popupItem = popup ? (popup.kind === 'pin' ? pins.find(p => p.id === popup.id) : eateries.find(e => e.id === popup.id)) ?? null : null
  const popupIcon = (() => {
    if (!popup || !popupItem) return undefined
    if (popup.kind === 'pin') {
      const p = popupItem as Pin
      const look = pinLook(p)
      return popupIconHtml({ color: look.color, icon: look.art ?? look.icon }, p.michelin)
    }
    const e = popupItem as Eatery
    const look = pinLook({ category: 'food', subcategory: e.cuisine, subsubcategory: e.dish })
    return popupIconHtml(look, e.michelin)
  })()
  // Without a map (no Google key) a list click still opens the edit panel.
  const hasMap = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY)

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

  // Phone back gesture: close the top layer first (session 10).
  const formOpen = !!pinEdit || !!eateryEdit || editing
  const layer = formOpen ? 'form' : popup ? 'card' : tripMenu ? 'menu' : snap === 'full' ? 'full' : null
  useBackStep(phone, layer, () => {
    if (editing) setEditing(false)
    else if (pinEdit) setPinEdit(null)
    else if (eateryEdit) setEateryEdit(null)
    else if (popup) setPopup(null)
    else if (tripMenu) setTripMenu(false)
    else setSnap('half')
  })

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

  // ---- Phone (session 10) ----
  if (phone) {
    const card = popupItem && popup && (
      <div className={styles.pCard}>
        <PlacePopup
          fill
          place={{
            name: popupItem.name,
            googlePlaceId: popupItem.google_place_id,
            lat: popupItem.lat,
            lng: popupItem.lng,
            note: popupItem.note,
            deleteText: popup.kind === 'pin' ? (isSpot(popup.id) ? "Remove this place? It leaves every trip and goes to the owner's pending-deletion list." : 'Delete this pin?') : "Remove this eatery? It goes to the owner's pending-deletion list.",
            iconHtml: popupIcon,
            vibes: vibeLabels(popupItem)
          }}
          onClose={() => setPopup(null)}
          onEdit={() => {
            setPopup(null)
            if (popup.kind === 'eatery') setEateryEdit({ mode: 'edit', id: popup.id })
            else setPinEdit({ mode: 'edit', pinId: popup.id })
            setTab('places')
            setSnap('full')
          }}
          onDelete={async () => {
            if (popup.kind === 'pin') { await deletePin(popup.id); setPopup(null); await loadPins() }
            else { await requestEateryDeletion(popup.id); setPopup(null); await loadEateries() }
          }}
          onSaveNote={async note => {
            if (popup.kind === 'pin') { await savePinNote(popup.id, note); await loadPins() }
            else { await saveEateryNote(popup.id, note); await loadEateries() }
          }}
        />
      </div>
    )
    // A place from the list or a pin: the sheet drops, the map centres the
    // place above its card, and the card opens.
    const showPlace = (kind: 'pin' | 'eatery', at: { id: string; lat: number; lng: number }) => {
      setSnap('closed')
      setFocus({ lat: at.lat, lng: at.lng, dy: -PHONE_CARD_LIFT })
      setPopup({ kind, id: at.id })
    }
    const pickTab = (t: 'places' | 'itinerary') => {
      setPopup(null)
      // Session 13 (E104): closed → that section opens full screen; open →
      // the other tab swaps in at the same height; the open tab again closes it.
      if (snap === 'closed') { setTab(t); setSnap('full') }
      else if (t !== tab) setTab(t)
      else setSnap('closed')
    }
    return (
      <main className={`segoe ${styles.pPage}`}>
        <header className={styles.pBar}>
          <Link to="/wander" className={styles.pBack} aria-label="Your trips">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
          </Link>
          <div className={styles.pTitles}>
            <h1 className={styles.pH1}>{trip.name}</h1>
            <span className={styles.pMeta}>{dates}{people.length ? ` · ${people.length} ${people.length === 1 ? 'person' : 'people'}` : ''}</span>
          </div>
          <div className={styles.pMenuWrap}>
            <button type="button" className={styles.pIcon} aria-label="Trip menu" aria-expanded={tripMenu} onClick={() => setTripMenu(m => !m)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
            </button>
            {tripMenu && (
              <div className={styles.pMenu} role="menu">
                <button type="button" role="menuitem" onClick={() => { setTripMenu(false); setEditing(true) }}>Edit trip</button>
                <button type="button" role="menuitem" onClick={() => { setTripMenu(false); setSharing(true) }}>Share &amp; people</button>
                <button type="button" role="menuitem" onClick={() => { setTripMenu(false); setCopying(true) }}>Copy pins</button>
                <button type="button" role="menuitem" onClick={() => { setTripMenu(false); setLookReq(n => n + 1) }}>Map look &amp; GPins</button>
              </div>
            )}
          </div>
          <PhoneMenu />
        </header>

        <div className={styles.pBody}>
          <TripMap
            city={city}
            pins={allMapPins}
            route={routeOn ? dayRoute : null}
            focus={focus}
            phone
            openLook={lookReq}
            routeOn={routeOn}
            onRouteToggle={() => setRouteOn(r => !r)}
            dayCity={dayCity}
            onDayCity={refreshDayCity}
            onPinClick={id => {
              const kind = eateries.some(e => e.id === id) ? 'eatery' : 'pin'
              const at = kind === 'eatery' ? eateries.find(e => e.id === id) : pins.find(p => p.id === id)
              if (at) showPlace(kind, at)
            }}
            onMapClick={() => { setPopup(null); setSnap('closed'); setTripMenu(false) }}
            onView={setView}
          />
          <BottomSheet label="Places" snap={snap} onSnap={setSnap} hidden={tab !== 'places' || !!card}>
            <PlacesPanel
              tripId={trip.id}
              userId={userId}
              people={people}
              pins={pins}
              reviews={reviews}
              eateries={eateries}
              eateriesInView={eateriesInView}
              pinsInView={pinsInView}
              eateryReviews={eateryReviews}
              loadError={pinsError}
              showAll={showAll}
              onShowAll={on => { setShowAll(on); if (on) setPicked(new Set()) }}
              picked={picked}
              onPick={ids => { setPicked(p => togglePicks(p, ids, showAll)); setShowAll(false) }}
              michelinOnly={michelinOnly}
              onMichelinOnly={setMichelinOnly}
              editing={pinEdit}
              onEditing={e => { setPinEdit(e); if (e) setSnap('full') }}
              eateryEdit={eateryEdit}
              onEateryEdit={e => { setEateryEdit(e); if (e) setSnap('full') }}
              onSaved={() => loadPins()}
              onEateriesSaved={() => loadEateries()}
              onFocus={at => setFocus({ lat: at.lat, lng: at.lng })}
              onOpenPlace={hasMap ? (kind, item) => showPlace(kind, item) : undefined}
              near={city.state === 'ready' ? { lat: city.city.lat, lng: city.city.lng } : undefined}
              openDay={openDay}
              onAddToDay={(id, kind) => setAddReq(r => ({ id, kind, n: (r?.n ?? 0) + 1 }))}
            />
          </BottomSheet>
          <BottomSheet label="Itinerary" snap={snap} onSnap={setSnap} hidden={tab !== 'itinerary' || !!card}>
            <ItineraryPanel
              tripId={trip.id}
              start={trip.start_date}
              end={trip.end_date}
              wide={false}
              phone
              routeOn={routeOn}
              pins={pins}
              reviews={reviews}
              eateries={eateries}
              eateryReviews={eateryReviews}
              addRequest={addReq}
              onWide={() => undefined}
              onClose={() => setSnap('closed')}
              onOpenDay={setOpenDay}
              onOtdPins={setOtdPinIds}
              onDayRoute={setDayRoute}
            />
          </BottomSheet>
          {card}
        </div>

        <nav className={styles.pNav} aria-label="Trip views">
          <button type="button" aria-pressed={snap !== 'closed' && tab === 'places'} onClick={() => pickTab('places')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
            Places
          </button>
          <button type="button" aria-pressed={snap !== 'closed' && tab === 'itinerary'} onClick={() => pickTab('itinerary')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>
            Itinerary
          </button>
        </nav>

        {editing && (
          <div className={styles.pOverlay} role="dialog" aria-label="Edit trip">
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
          </div>
        )}
        {sharing && (
          <ShareDialog
            trip={trip}
            people={people}
            isOwner={isOwner}
            myName={myName ?? null}
            userId={userId}
            onTokenChange={token => setLoad({ state: 'ready', trip: { ...trip, invite_token: token } })}
            onPeopleChange={loadPeople}
            onNameChange={name => { setMyName(name); loadPeople() }}
            onClose={() => setSharing(false)}
          />
        )}
        {copying && (
          <CopyPinsDialog tripId={trip.id} tripName={trip.name} pins={pins.filter(p => p.source !== 'spot')} onCopied={() => void loadPins()} onClose={() => setCopying(false)} />
        )}
        {myName === null && !nameLater && !sharing && (
          <NamePrompt userId={userId} onSaved={name => { setMyName(name); loadPeople() }} onLater={() => setNameLater(true)} />
        )}
      </main>
    )
  }

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
          <button type="button" className="btn btn-quiet" onClick={() => setCopying(true)}>Copy pins</button>
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
          eateries={eateries}
          eateriesInView={eateriesInView}
          pinsInView={pinsInView}
          eateryReviews={eateryReviews}
          loadError={pinsError}
          showAll={showAll}
          onShowAll={on => { setShowAll(on); if (on) setPicked(new Set()) }}
          picked={picked}
          onPick={ids => { setPicked(p => togglePicks(p, ids, showAll)); setShowAll(false) }}
          michelinOnly={michelinOnly}
          onMichelinOnly={setMichelinOnly}
          editing={pinEdit}
          onEditing={setPinEdit}
          eateryEdit={eateryEdit}
          onEateryEdit={setEateryEdit}
          onSaved={() => loadPins()}
          onEateriesSaved={() => loadEateries()}
          onFocus={at => setFocus({ lat: at.lat, lng: at.lng })}
          onOpenPlace={hasMap ? (kind, item) => { setFocus({ lat: item.lat, lng: item.lng }); setPopup({ kind, id: item.id }) } : undefined}
          onEditPlace={(kind, id) => {
            setPopup(null)
            if (kind === 'eatery') setEateryEdit({ mode: 'edit', id })
            else setPinEdit({ mode: 'edit', pinId: id })
          }}
          near={city.state === 'ready' ? { lat: city.city.lat, lng: city.city.lng } : undefined}
          openDay={panel.open ? openDay : null}
          onAddToDay={(id, kind) => setAddReq(r => ({ id, kind, n: (r?.n ?? 0) + 1 }))}
        />
        <div className={styles.mapArea}>
          <TripMap
            city={city}
            rightInset={panel.open ? (panel.wide ? 2 : 1) * PANEL_WIDTH : 0}
            pins={allMapPins}
            route={panel.open ? dayRoute : null}
            onView={setView}
            dayCity={dayCity}
            onDayCity={refreshDayCity}
            focus={focus}
            onPinClick={id => setPopup({ kind: eateries.some(e => e.id === id) ? 'eatery' : 'pin', id })}
            popupAt={popupItem ? { lat: popupItem.lat, lng: popupItem.lng } : null}
            onPopupClose={() => setPopup(null)}
            popup={
              popupItem && popup ? (
                <PlacePopup
                  place={{
                    name: popupItem.name,
                    googlePlaceId: popupItem.google_place_id,
                    lat: popupItem.lat,
                    lng: popupItem.lng,
                    note: popupItem.note,
                    deleteText: popup.kind === 'pin' ? (isSpot(popup.id) ? "Remove this place? It leaves every trip and goes to the owner's pending-deletion list." : 'Delete this pin?') : "Remove this eatery? It goes to the owner's pending-deletion list.",
                    iconHtml: popupIcon,
                    vibes: vibeLabels(popupItem)
                  }}
                  onClose={() => setPopup(null)}
                  onEdit={() => {
                    setPopup(null)
                    if (popup.kind === 'eatery') setEateryEdit({ mode: 'edit', id: popup.id })
                    else setPinEdit({ mode: 'edit', pinId: popup.id })
                  }}
                  onDelete={async () => {
                    if (popup.kind === 'pin') { await deletePin(popup.id); setPopup(null); await loadPins() }
                    else { await requestEateryDeletion(popup.id); setPopup(null); await loadEateries() }
                  }}
                  onSaveNote={async note => {
                    if (popup.kind === 'pin') { await savePinNote(popup.id, note); await loadPins() }
                    else { await saveEateryNote(popup.id, note); await loadEateries() }
                  }}
                />
              ) : null
            }
          />
          {panel.open ? (
            <ItineraryPanel
              tripId={trip.id}
              start={trip.start_date}
              end={trip.end_date}
              wide={panel.wide}
              pins={pins}
              reviews={reviews}
              eateries={eateries}
              eateryReviews={eateryReviews}
              addRequest={addReq}
              onWide={() => setPanel(p => ({ ...p, wide: !p.wide }))}
              onClose={() => setPanel(p => ({ ...p, open: false }))}
              onOpenDay={setOpenDay}
              onOtdPins={setOtdPinIds}
              onDayRoute={setDayRoute}
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

      {copying && (
        <CopyPinsDialog tripId={trip.id} tripName={trip.name} pins={pins.filter(p => p.source !== 'spot')} onCopied={() => void loadPins()} onClose={() => setCopying(false)} />
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

/** The trip's own legs plus legs linked in from other trips (as the itinerary shows them). */
async function fetchTripLegs(tripId: string, days: ItineraryDay[]): Promise<TravelLeg[]> {
  const own = await fetchLegs(days.map(d => d.id))
  const links = await fetchLegLinks(tripId).catch(() => [])
  const incoming = links.filter(k => k.direction === 'in').map(k => k.leg_id)
  const linked = await fetchLegsByIds(incoming).catch(() => [] as TravelLeg[])
  return [...own, ...linked]
}
