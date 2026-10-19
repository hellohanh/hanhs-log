import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { isSupabaseConfigured } from '../../lib/supabase'
import { deletePin, fetchAllSpots, fetchReviews, savePinNote, searchPlaces, type FoundPlace, type Pin, type Review } from '../../lib/pins'
import { savorlogPeople } from '../../lib/eateries'
import type { Person } from '../../lib/trips'
import { resolveScope, type Scope } from '../../lib/savorLocation'
import { onScreen, type Bounds } from '../../lib/countryBounds'
import { pinLook } from '../../lib/pinCatalog'
import { pinBox, pinHtml, popupIconHtml } from '../../lib/pinDraw'
import { pinBadge, pinFaded, togglePicks } from '../../lib/pinRules'
import PinTree from '../wander/PinTree'
import PinForm from '../wander/PinForm'
import PlacePopup from '../../components/PlacePopup'
import SavorMap, { type Frame } from '../savor/SavorMap'
import { LocationField } from '../savor/SavorPage'
import { type MapPin } from '../wander/mapPinLayer'
import styles from '../savor/Savor.module.css'
import tstyles from '../wander/TripPage.module.css'
import BottomSheet, { type Snap } from '../../components/BottomSheet'
import PhoneMenu from '../../components/PhoneMenu'
import { useIsPhone } from '../../lib/usePhone'
import { useBackStep } from '../../lib/useBackStep'

// Roaminglog's Spot List (/roam, session 14, step 4): the shared catalogue of
// non-eatery places (sights, stays, shops, airports, stations), laid out like
// the Munch List: the list follows the map, a pin or row opens the popup,
// double-click (or ✎) edits, and the Google search adds a spot. Every trip's
// map shows these spots too. Removing one sends it to the owner's
// pending-deletion list.

type Editing = { mode: 'add'; place: FoundPlace } | { mode: 'edit'; id: string } | null
const REMOVE_TEXT = "Remove this spot? It leaves every trip and goes to the owner's pending-deletion list."

export default function RoamPage() {
  const { session, loading } = useAuth()
  if (!isSupabaseConfigured) return <Message text="Sign-in isn't set up in this build, so Roaminglog can't be shown." />
  if (loading) return <Message text="Loading…" />
  if (!session) {
    return (
      <Message text="Sign in to open Roaminglog.">
        <Link to="/signin" className="btn" style={{ marginTop: 24 }}>Sign in</Link>
      </Message>
    )
  }
  return <RoamLoaded userId={session.user.id} />
}

function Message({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <main className="page segoe">
      <p className="eyebrow">Roaminglog</p>
      <h1 style={{ fontSize: 48, margin: '12px 0 16px' }}>Spot List</h1>
      <p className="lede" role="status">{text}</p>
      {children}
    </main>
  )
}

function RoamLoaded({ userId }: { userId: string }) {
  const [spots, setSpots] = useState<Pin[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [error, setError] = useState('')
  const [showAll, setShowAll] = useState(true)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [popupId, setPopupId] = useState<string | null>(null)
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null)
  const hasMap = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
  const [editing, setEditing] = useState<Editing>(null)
  const [scope, setScope] = useState<Scope | null>(null)
  const [view, setView] = useState<Bounds | null>(null)
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<FoundPlace[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const phone = useIsPhone()
  const [topSnap, setTopSnap] = useState<Snap>('half')
  const [listSnap, setListSnap] = useState<Snap>('closed')

  const load = useCallback(async () => {
    try {
      const ss = await fetchAllSpots()
      setSpots(ss)
      setReviews(await fetchReviews(ss.map(s => s.id)))
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
    savorlogPeople().then(setPeople, () => setPeople([]))
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const shown = useMemo(() => onScreen(spots, view, hasMap), [spots, view, hasMap])
  const frame = useMemo<Frame | null>(
    () => (scope ? (scope.kind === 'country' ? { bounds: scope.bounds, center: scope.center } : { center: scope.center, zoom: 13 }) : null),
    [scope]
  )
  const mapPins = useMemo<MapPin[]>(
    () =>
      shown.map(s => {
        const look = pinLook(s)
        const box = pinBox({ michelin: null })
        return {
          id: s.id, lat: s.lat, lng: s.lng,
          title: `${s.name} (${look.label})`,
          html: pinHtml({ color: look.color, icon: look.art ?? look.icon, michelin: null, badge: pinBadge(reviews.filter(r => r.pin_id === s.id)) }),
          width: box.width, height: box.height,
          faded: pinFaded({ id: s.id, michelin: null }, { editing: false, otdPins: null, showAll, michelinOnly: false, picked })
        }
      }),
    [shown, reviews, showAll, picked]
  )

  const near = view ? { lat: (view.south + view.north) / 2, lng: (view.west + view.east) / 2 } : scope?.center
  async function search(e: FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setSearchError('')
    try {
      setFound(await searchPlaces(query, near))
    } catch (err) {
      setFound(null)
      setSearchError((err as Error).message)
    } finally {
      setSearching(false)
    }
  }
  function pick(place: FoundPlace) {
    setFound(null)
    setQuery('')
    const already = spots.find(s => s.google_place_id === place.id)
    setEditing(already ? { mode: 'edit', id: already.id } : { mode: 'add', place })
    if (phone) { setTopSnap('closed'); setListSnap('full') }
  }
  const chooseScope = (s: Scope) => {
    setScope(s)
    setPicked(new Set())
    setEditing(null)
    setFound(null)
    setQuery('')
    if (phone) setTopSnap('closed')
  }

  const popupSpot = popupId ? spots.find(s => s.id === popupId) ?? null : null
  const editingSpot = editing?.mode === 'edit' ? spots.find(s => s.id === editing.id) : undefined

  const phoneLayer = !phone ? null : editing ? 'form' : popupSpot ? 'card' : listSnap === 'full' ? 'full' : null
  useBackStep(phone, phoneLayer, () => {
    if (editing) setEditing(null)
    else if (popupSpot) setPopupId(null)
    else setListSnap('half')
  })

  const form = editing && (
    <PinForm
      key={editing.mode === 'edit' ? editing.id : editing.place.id}
      roam
      tripId=""
      userId={userId}
      people={people}
      place={editing.mode === 'add' ? editing.place : undefined}
      pin={editingSpot}
      reviews={editingSpot ? reviews.filter(r => r.pin_id === editingSpot.id) : []}
      openDay={null}
      onCancel={() => setEditing(null)}
      onSaved={() => { setEditing(null); load() }}
    />
  )

  const searchBox = (
    <>
      <LocationField onPick={h => chooseScope(resolveScope(h))} />
      <form className={styles.search} role="search" onSubmit={search}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input type="search" value={query} onChange={e => { setQuery(e.target.value); if (!e.target.value) setFound(null) }} placeholder="Search Google to add a spot" aria-label="Search Google for a spot to add" />
        <button type="submit" className={styles.go} disabled={searching}>{searching ? '…' : 'Search'}</button>
      </form>
      {searchError && <p className={styles.error} role="alert">{searchError}</p>}
      {found && (
        <ul className={styles.results} aria-label="Search results">
          {found.length === 0 && <li className={styles.muted} style={{ padding: '8px 12px' }}>Nothing found. Try other words.</li>}
          {found.map(f => {
            const already = spots.some(s => s.google_place_id === f.id)
            return (
              <li key={f.id}>
                <button type="button" className={styles.res} onClick={() => pick(f)}>
                  <span><b>{f.name}</b>{f.address ? <span className={styles.resSub}> {f.address}</span> : null}{already ? <span className={styles.resSub}> · already added</span> : null}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )

  const list = (
    <>
      <div className={styles.head}>
        <strong>Spots</strong>
        <span className={styles.count}>{shown.length > 0 ? (phone ? `${shown.length} on screen` : shown.length) : ''}</span>
      </div>
      {error && <p className={styles.error} role="alert">Couldn't load the spots: {error}</p>}
      {shown.length > 0 && (
        <div className={styles.filters}>
          <label className={styles.showAll}>
            <input type="checkbox" checked={showAll} onChange={e => { setShowAll(e.target.checked); if (e.target.checked) setPicked(new Set()) }} /> Show all
          </label>
        </div>
      )}
      {shown.length === 0 && !error && (
        <p className={styles.muted}>No spots in this part of the map. Move the map, or search to add one.</p>
      )}
      {shown.length > 0 && (
        <PinTree
          pins={shown}
          reviews={reviews}
          openDay={null}
          onOpen={s => {
            if (!hasMap) { setEditing({ mode: 'edit', id: s.id }); if (phone) setListSnap('full'); return }
            if (phone) setListSnap('closed')
            setFocus({ lat: s.lat, lng: s.lng })
            setPopupId(s.id)
          }}
          onEdit={phone ? undefined : s => { setPopupId(null); setEditing({ mode: 'edit', id: s.id }) }}
          picked={picked}
          showAll={showAll}
          onPick={ids => { setPicked(p => togglePicks(p, ids, showAll)); setShowAll(false) }}
        />
      )}
    </>
  )

  const popup = (fill: boolean) =>
    popupSpot ? (
      <PlacePopup
        fill={fill}
        place={{
          name: popupSpot.name,
          googlePlaceId: popupSpot.google_place_id,
          lat: popupSpot.lat,
          lng: popupSpot.lng,
          note: popupSpot.note,
          deleteText: REMOVE_TEXT,
          iconHtml: popupIconHtml(pinLook(popupSpot), null)
        }}
        onClose={() => setPopupId(null)}
        onEdit={() => { setPopupId(null); setEditing({ mode: 'edit', id: popupSpot.id }); if (phone) setListSnap('full') }}
        onDelete={async () => { await deletePin(popupSpot.id); setPopupId(null); await load() }}
        onSaveNote={async note => { await savePinNote(popupSpot.id, note); await load() }}
      />
    ) : null

  if (phone) {
    return (
      <main className={`segoe ${tstyles.pPage}`}>
        <header className={tstyles.pBar}>
          <Link to="/" className={tstyles.pBack} aria-label="Home">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
          </Link>
          <div className={tstyles.pTitles}>
            <span className={styles.phoneEyebrow}>Roaminglog</span>
            <h1 className={tstyles.pH1}>Spot List</h1>
          </div>
          <PhoneMenu />
        </header>
        <div className={tstyles.pBody}>
          <SavorMap
            phone
            pins={mapPins}
            frame={frame}
            onView={setView}
            focus={focus}
            onPinClick={id => { if (shown.some(s => s.id === id)) { setPopupId(id); setListSnap('closed') } }}
            onMapClick={() => setPopupId(null)}
          />
          <BottomSheet edge="top" fit label="Search" snap={topSnap} onSnap={setTopSnap}>
            <div className={styles.phoneSearch}>{searchBox}</div>
          </BottomSheet>
          <BottomSheet label="Spots" snap={editing ? 'full' : listSnap} onSnap={s => { if (!editing) setListSnap(s) }} hidden={!!popupSpot}>
            {form || <div className={styles.phoneCat}>{list}</div>}
          </BottomSheet>
          {popupSpot && <div className={tstyles.pCard}>{popup(true)}</div>}
        </div>
      </main>
    )
  }

  return (
    <main className={`segoe ${styles.page}`}>
      <div className={styles.bar}>
        <div className={styles.titles}>
          <p className={styles.eyebrow}>Roaminglog</p>
          <h1 className={styles.h1}>Spot List</h1>
        </div>
      </div>
      <div className={styles.body}>
        <aside className={styles.side} aria-label="Spots">
          {form || (
            <>
              {searchBox}
              {list}
            </>
          )}
        </aside>
        <div className={styles.mapArea}>
          <SavorMap
            pins={mapPins}
            frame={frame}
            onView={setView}
            focus={focus}
            onPinClick={id => { if (shown.some(s => s.id === id)) setPopupId(id) }}
            popupAt={popupSpot ? { lat: popupSpot.lat, lng: popupSpot.lng } : null}
            onPopupClose={() => setPopupId(null)}
            popup={popup(false)}
          />
        </div>
      </div>
    </main>
  )
}
