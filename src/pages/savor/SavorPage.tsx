import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { isSupabaseConfigured } from '../../lib/supabase'
import { fetchCatalogue, fetchEateryReviews, claimSavorlog, asReviews, savorlogInvite, savorlogPeople, type Eatery, type EateryReview } from '../../lib/eateries'
import { searchPlaces, type FoundPlace } from '../../lib/pins'
import { fetchMyName, type Person } from '../../lib/trips'
import { searchLocations, resolveScope, inScope, type LocationHit, type Scope } from '../../lib/savorLocation'
import { inView, type Bounds } from '../../lib/countryBounds'
import { pinLook } from '../../lib/pinCatalog'
import { pinBox, pinHtml, flowerSvg } from '../../lib/pinDraw'
import { pinBadge, pinFaded, togglePicks } from '../../lib/pinRules'
import EateryTree from './EateryTree'
import SavorMap, { type Frame } from './SavorMap'
import SavorForm from './SavorForm'
import SavorShareDialog from './SavorShareDialog'
import NamePrompt from '../wander/NamePrompt'
import { type MapPin } from '../wander/mapPinLayer'
import styles from './Savor.module.css'

// The Savorlog page (/savor): a required location gate (E66) scopes the page to
// a country or a city, then the shared eatery catalogue by country → dish on
// the left and the chosen place on one map. Add / edit from the search box and
// the card (4d).

const asLook = (e: Eatery) => ({ category: 'food', subcategory: e.cuisine, subsubcategory: e.dish })
type Editing = { mode: 'add'; place: FoundPlace } | { mode: 'edit'; id: string } | null

export default function SavorPage() {
  const { session, loading } = useAuth()
  if (!isSupabaseConfigured) return <Message text="Sign-in isn't set up in this build, so Savorlog can't be shown." />
  if (loading) return <Message text="Loading…" />
  if (!session) {
    return (
      <Message text="Sign in to open Savorlog.">
        <Link to="/signin" className="btn" style={{ marginTop: 24 }}>Sign in</Link>
      </Message>
    )
  }
  return <SavorLoaded userId={session.user.id} />
}

function Message({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <main className="page segoe">
      <p className="eyebrow">Savorlog</p>
      <h1 style={{ fontSize: 48, margin: '12px 0 16px' }}>Eateries</h1>
      <p className="lede" role="status">{text}</p>
      {children}
    </main>
  )
}

function SavorLoaded({ userId }: { userId: string }) {
  const [eateries, setEateries] = useState<Eatery[]>([])
  const [reviews, setReviews] = useState<EateryReview[]>([])
  const [error, setError] = useState('')
  const [showAll, setShowAll] = useState(true)
  // The eyes on the catalogue rows (session 10): picks, not remembered.
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [michelinOnly, setMichelinOnly] = useState(false)
  const [editing, setEditing] = useState<Editing>(null)
  const [scope, setScope] = useState<Scope | null>(null)
  // The place popup can be closed (session 10): then the page shows whatever
  // is in the map view, starting on the whole world.
  const [closed, setClosed] = useState(false)
  const [view, setView] = useState<Bounds | null>(null)
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<FoundPlace[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  // The Savorlog circle (4e): members, your name, the Family dialog.
  const [people, setPeople] = useState<Person[]>([])
  const [myName, setMyName] = useState<string | null | undefined>(undefined)
  const [nameLater, setNameLater] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [inviteToken, setInviteToken] = useState('')

  const loadCircle = useCallback(() => savorlogPeople().then(setPeople, () => setPeople([])), [])
  const load = useCallback(async () => {
    try {
      await claimSavorlog().catch(() => {})
      const es = await fetchCatalogue()
      setEateries(es)
      setReviews(await fetchEateryReviews(es.map(e => e.id)))
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
    loadCircle()
    fetchMyName(userId).then(setMyName, () => setMyName(undefined))
  }, [loadCircle, userId])
  useEffect(() => {
    load()
  }, [load])

  const isOwner = people.find(p => p.is_me)?.is_owner ?? false
  async function openShare() {
    try {
      setInviteToken(await savorlogInvite())
    } catch {
      setInviteToken('')
    }
    setSharing(true)
  }

  const byView = !scope && closed
  const shown = useMemo(
    () => (scope ? eateries.filter(e => inScope(e, scope)) : byView && view ? eateries.filter(e => inView(view, e.lat, e.lng)) : []),
    [eateries, scope, byView, view]
  )
  const active = Boolean(scope) || byView
  const hasMichelin = shown.some(e => e.michelin)
  const michelinCount = shown.filter(e => e.michelin).length
  const frame: Frame | null = scope ? (scope.kind === 'country' ? { bounds: scope.bounds, center: scope.center } : { center: scope.center, zoom: 13 }) : null

  const mapPins = useMemo<MapPin[]>(
    () =>
      shown.map(e => {
        const look = pinLook(asLook(e))
        const box = pinBox(e)
        return {
          id: e.id, lat: e.lat, lng: e.lng,
          title: `${e.name} (${look.label})`,
          html: pinHtml({ color: look.color, icon: look.icon, michelin: e.michelin, badge: pinBadge(asReviews(reviews, e.id)) }),
          width: box.width, height: box.height,
          faded: pinFaded({ id: e.id, michelin: e.michelin }, { editing: false, otdPins: null, showAll, michelinOnly, picked })
        }
      }),
    [shown, reviews, showAll, michelinOnly, picked]
  )

  const chooseScope = (s: Scope) => {
    setScope(s)
    setPicked(new Set())
    setEditing(null)
    setFound(null)
    setQuery('')
  }

  async function search(e: FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setSearchError('')
    try {
      setFound(await searchPlaces(query, scope?.center))
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
    const already = eateries.find(e => e.google_place_id === place.id)
    setEditing(already ? { mode: 'edit', id: already.id } : { mode: 'add', place })
  }

  const editingEatery = editing?.mode === 'edit' ? eateries.find(e => e.id === editing.id) : undefined

  return (
    <main className={`segoe ${styles.page}`}>
      <div className={styles.bar}>
        <div className={styles.titles}>
          <p className={styles.eyebrow}>Savorlog</p>
          <h1 className={styles.h1}>Eateries</h1>
        </div>
        <div className={styles.where}>
          {scope && (
            <>
              Showing <b>{scope.name}</b> {scope.kind === 'city' ? '(city)' : '(country)'}
              <button type="button" className={styles.change} onClick={() => { setScope(null); setClosed(false) }}>Change</button>
            </>
          )}
          {byView && (
            <>
              Showing <b>the map view</b>
              <button type="button" className={styles.change} onClick={() => setClosed(false)}>Pick a place</button>
            </>
          )}
          <button type="button" className={styles.change} onClick={openShare}>Family</button>
        </div>
      </div>
      <div className={styles.body}>
        <aside className={styles.side} aria-label="Catalogue">
          {editing ? (
            <SavorForm
              key={editing.mode === 'edit' ? editing.id : editing.place.id}
              userId={userId}
              place={editing.mode === 'add' ? editing.place : undefined}
              eatery={editingEatery}
              reviews={editingEatery ? reviews.filter(r => r.eatery_id === editingEatery.id) : []}
              onCancel={() => setEditing(null)}
              onSaved={() => { setEditing(null); load() }}
            />
          ) : (
            <>
              <form className={styles.search} role="search" onSubmit={search}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                <input type="search" value={query} onChange={e => { setQuery(e.target.value); if (!e.target.value) setFound(null) }} placeholder="Search Google to add an eatery" aria-label="Search Google for an eatery to add" />
                <button type="submit" className={styles.go} disabled={searching}>{searching ? '…' : 'Search'}</button>
              </form>
              {searchError && <p className={styles.error} role="alert">{searchError}</p>}
              {found && (
                <ul className={styles.results} aria-label="Search results">
                  {found.length === 0 && <li className={styles.muted} style={{ padding: '8px 12px' }}>Nothing found. Try other words.</li>}
                  {found.map(f => {
                    const already = eateries.some(e => e.google_place_id === f.id)
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

              <div className={styles.head}>
                <strong>Catalogue</strong>
                <span className={styles.count}>{shown.length > 0 ? shown.length : ''}</span>
              </div>
              {error && <p className={styles.error} role="alert">Couldn't load the catalogue: {error}</p>}
              {active && shown.length > 0 && (
                <div className={styles.filters}>
                  <label className={styles.showAll}>
                    <input type="checkbox" checked={showAll} onChange={e => { setShowAll(e.target.checked); if (e.target.checked) setPicked(new Set()) }} /> Show all
                  </label>
                  {hasMichelin && (
                    <button type="button" className={styles.chip} aria-pressed={michelinOnly} onClick={() => setMichelinOnly(v => !v)} title="Show only MICHELIN eateries on the map">
                      <span dangerouslySetInnerHTML={{ __html: flowerSvg(13, '#9E2A2B') }} /> MICHELIN {michelinCount}
                    </button>
                  )}
                </div>
              )}
              {scope && shown.length === 0 && !error && (
                <p className={styles.muted}>No eateries in {scope.name} yet. Search above to add one.</p>
              )}
              {byView && shown.length === 0 && !error && (
                <p className={styles.muted}>No eateries in this part of the map. Move the map, or search above to add one.</p>
              )}
              {active && shown.length > 0 && (
                <EateryTree
                  key={scope ? scope.name : 'map-view'}
                  eateries={shown}
                  reviews={reviews}
                  onOpen={e => setEditing({ mode: 'edit', id: e.id })}
                  picked={picked}
                  showAll={showAll}
                  onPick={ids => { setPicked(p => togglePicks(p, ids, showAll)); setShowAll(false) }}
                />
              )}
            </>
          )}
        </aside>
        <div className={styles.mapArea}>
          <SavorMap pins={mapPins} frame={frame} onView={setView} onPinClick={id => { if (shown.some(e => e.id === id)) setEditing({ mode: 'edit', id }) }} />
        </div>
      </div>
      {!scope && !closed && !sharing && <LocationPicker onPick={h => chooseScope(resolveScope(h))} onClose={() => setClosed(true)} />}
      {sharing && (
        <SavorShareDialog
          token={inviteToken}
          people={people}
          isOwner={isOwner}
          myName={myName ?? null}
          userId={userId}
          onTokenChange={setInviteToken}
          onPeopleChange={loadCircle}
          onNameChange={name => { setMyName(name); loadCircle() }}
          onClose={() => setSharing(false)}
        />
      )}
      {myName === null && !nameLater && !sharing && scope && (
        <NamePrompt userId={userId} onSaved={name => { setMyName(name); loadCircle() }} onLater={() => setNameLater(true)} />
      )}
    </main>
  )
}

function LocationPicker({ onPick, onClose }: { onPick: (hit: LocationHit) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<LocationHit[]>([])
  const [searching, setSearching] = useState(false)
  const [err, setErr] = useState('')
  const seq = useRef(0)

  function run(q: string) {
    setQuery(q)
    const n = ++seq.current
    if (!q.trim()) { setHits([]); setErr(''); return }
    setSearching(true)
    searchLocations(q).then(
      r => { if (n === seq.current) { setHits(r); setErr(''); setSearching(false) } },
      e => { if (n === seq.current) { setHits([]); setErr((e as Error).message); setSearching(false) } }
    )
  }

  // Closable (session 10): ×, Escape, or a click outside the box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={styles.scrim} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`${styles.modal} ${styles.modalClosable}`} role="dialog" aria-modal="true" aria-label="Where to see eateries">
        <button type="button" className={styles.modalX} aria-label="Close" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
        <h2 className={styles.modalH}>Where do you want to see eateries?</h2>
        <p className={styles.modalP}>Pick a country or a city, or close this to move the map yourself.</p>
        <form className={styles.search} role="search" onSubmit={e => e.preventDefault()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input autoFocus type="search" value={query} onChange={e => run(e.target.value)} placeholder="Search a country or city" aria-label="Search a country or city" />
        </form>
        {err && <p className={styles.error} role="alert">{err}</p>}
        {hits.length > 0 && (
          <ul className={styles.results} aria-label="Places">
            {hits.map(h => (
              <li key={h.id}>
                <button type="button" className={styles.res} onClick={() => onPick(h)}>
                  <span><b>{h.name}</b>{h.kind === 'city' && h.sub ? <span className={styles.resSub}> {h.sub}</span> : null}</span>
                  <span className={styles.kind}>{h.kind}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {query.trim() && !searching && hits.length === 0 && !err && <p className={styles.muted}>Nothing found. Try another name.</p>}
      </div>
    </div>
  )
}

