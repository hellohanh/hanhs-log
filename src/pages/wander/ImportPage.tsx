import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { isSupabaseConfigured } from '../../lib/supabase'
import { categoryOf, pinLook } from '../../lib/pinCatalog'
import { fetchPins, searchPlaces, type FoundPlace, type Pin } from '../../lib/pins'
import { fetchTrips, placeLabel, type TripSummary } from '../../lib/trips'
import { fetchCatalogue, fetchEateryReviews, type Eatery, type EateryReview } from '../../lib/eateries'
import {
  IMPORT_ORDER, amSavorlogOwner, categoryItems, cityList, displayName, fetchImport, loadImport,
  markSaved, markSkipped, nextPending, parsePrepared, placeById, tally, type ImportItem
} from '../../lib/pinImport'
import PinForm from './PinForm'
import SavorForm from '../savor/SavorForm'
import { NewTripDialog } from './TripList'
import styles from './Import.module.css'

// The old-Wanderlog pin import queue (E71, approved mockup session 9):
// /wander/import. Load Claude's prepared file once; pick a city, then a
// category (standard order, Nom-Nom last); each place opens the real add card
// already filled in. Save and next / Skip for good / Back. Non-food places go
// into the trip picked for that city; food goes to the Savorlog catalogue.

const TRIP_CHOICE_KEY = 'hanhs-log-import-trips'
function readChoices(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(TRIP_CHOICE_KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}
function writeChoices(c: Record<string, string>) {
  try {
    localStorage.setItem(TRIP_CHOICE_KEY, JSON.stringify(c))
  } catch {
    /* this device won't remember the pick; that's fine */
  }
}

export default function ImportPage() {
  const { session, loading } = useAuth()
  if (!isSupabaseConfigured) return <Shell><p className="lede">Sign-in isn't set up in this build.</p></Shell>
  if (loading) return <Shell><p className="lede" role="status">Loading…</p></Shell>
  if (!session) {
    return (
      <Shell>
        <p className="lede">Sign in to import your old Wanderlog pins.</p>
        <Link to="/signin" className="btn" style={{ marginTop: 24 }}>Sign in</Link>
      </Shell>
    )
  }
  return <Importer userId={session.user.id} />
}

function Shell({ children, summary }: { children: React.ReactNode; summary?: string }) {
  return (
    <main className={`segoe ${styles.page}`}>
      <Link to="/wander" className={styles.back}>‹ Your trips</Link>
      <p className="eyebrow">Wanderlog</p>
      <h1 className={styles.h1}>Import old pins</h1>
      {summary && <p className={styles.summary}>{summary}</p>}
      {children}
    </main>
  )
}

type View = { kind: 'city' } | { kind: 'card'; category: string; index: number }

function Importer({ userId }: { userId: string }) {
  const [owner, setOwner] = useState<boolean | null>(null)
  const [items, setItems] = useState<ImportItem[] | null>(null)
  const [error, setError] = useState('')
  const [trips, setTrips] = useState<TripSummary[]>([])
  const [catalogue, setCatalogue] = useState<Eatery[]>([])
  const [city, setCity] = useState<string | null>(null)
  const [view, setView] = useState<View>({ kind: 'city' })
  const [choices, setChoices] = useState<Record<string, string>>(readChoices)
  const [notice, setNotice] = useState('')
  const [creatingTrip, setCreatingTrip] = useState(false)

  const reload = useCallback(async () => {
    try {
      const [o, list] = await Promise.all([amSavorlogOwner(), fetchImport()])
      setOwner(o)
      setItems(list)
      fetchTrips().then(setTrips, () => setTrips([]))
      fetchCatalogue().then(setCatalogue, () => setCatalogue([]))
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])
  useEffect(() => {
    reload()
  }, [reload])

  const cities = useMemo(() => (items ? cityList(items) : []), [items])
  useEffect(() => {
    if (!city && cities.length) setCity(cities[0].city)
  }, [city, cities])

  if (error) return <Shell><p className={styles.error} role="alert">Couldn't load the import: {error}</p></Shell>
  if (!items || owner === null) return <Shell><p className="lede" role="status">Loading…</p></Shell>

  const all = tally(items)
  const skipped = items.filter(i => i.status === 'skipped').length
  const summary = items.length ? `${all.done} of ${all.total} places done · ${skipped} skipped` : undefined

  if (items.length === 0) {
    if (!owner) return <Shell><p className="lede">Only the Savorlog owner can import the old pins.</p></Shell>
    return (
      <Shell>
        <LoadPanel onLoaded={reload} />
      </Shell>
    )
  }

  const tripId = city ? choices[city] ?? '' : ''
  const trip = trips.find(t => t.id === tripId)
  const pickTrip = (id: string) => {
    if (!city) return
    const next = { ...choices, [city]: id }
    setChoices(next)
    writeChoices(next)
  }
  const updateItem = (id: string, patch: Partial<ImportItem>) => setItems(list => (list ?? []).map(i => (i.id === id ? { ...i, ...patch } : i)))

  return (
    <Shell summary={summary}>
      <div className={styles.layout}>
        <nav className={styles.rail} aria-label="Cities">
          {cities.map(c => (
            <button
              key={c.city}
              type="button"
              className={styles.cityRow}
              aria-current={c.city === city ? 'true' : undefined}
              onClick={() => { setCity(c.city); setView({ kind: 'city' }); setNotice('') }}
            >
              <span className={styles.cityName}>{c.city}</span>
              <span className={styles.count}>{c.tally.done} / {c.tally.total}</span>
            </button>
          ))}
        </nav>

        <section className={styles.main}>
          {city && view.kind === 'city' && (
            <CityView
              city={city}
              items={items}
              trips={trips}
              tripId={tripId}
              notice={notice}
              onPickTrip={pickTrip}
              onNewTrip={() => setCreatingTrip(true)}
              onOpen={(category, index) => { setNotice(''); setView({ kind: 'card', category, index }) }}
            />
          )}
          {city && view.kind === 'card' && (
            <CardView
              key={`${city}/${view.category}/${view.index}`}
              userId={userId}
              city={city}
              category={view.category}
              index={view.index}
              items={items}
              trip={trip}
              catalogue={catalogue}
              notice={notice}
              onGo={(index, msg) => { setNotice(msg ?? ''); setView({ kind: 'card', category: view.category, index }) }}
              onCity={msg => { setNotice(msg ?? ''); setView({ kind: 'city' }) }}
              onDone={(item, patch) => {
                updateItem(item.id, patch)
                if (patch.saved_eatery_id) fetchCatalogue().then(setCatalogue, () => undefined)
              }}
            />
          )}
        </section>
      </div>

      {creatingTrip && (
        <NewTripDialog
          userId={userId}
          onCancel={() => setCreatingTrip(false)}
          onCreated={async (_name, id) => {
            setCreatingTrip(false)
            setTrips(await fetchTrips().catch(() => trips))
            pickTrip(id)
          }}
        />
      )}
    </Shell>
  )
}

function LoadPanel({ onLoaded }: { onLoaded: () => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  return (
    <div className={styles.panel}>
      <p className={styles.panelHead}>Load the prepared file</p>
      <p className={styles.muted}>
        Pick the file Claude made from your Wanderlog export (<code>hanhs-log-import-….json</code>). It's loaded once; your progress is
        kept, so you can carry on from any device.
      </p>
      <label className="btn">
        {busy ? 'Loading…' : 'Choose file'}
        <input
          type="file"
          accept="application/json,.json"
          hidden
          disabled={busy}
          onChange={async e => {
            const file = e.target.files?.[0]
            if (!file) return
            setBusy(true)
            setErr('')
            try {
              await loadImport(parsePrepared(await file.text()))
              onLoaded()
            } catch (x) {
              setErr((x as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        />
      </label>
      {err && <p className={styles.error} role="alert">{err}</p>}
    </div>
  )
}

function CityView({
  city, items, trips, tripId, notice, onPickTrip, onNewTrip, onOpen
}: {
  city: string
  items: ImportItem[]
  trips: TripSummary[]
  tripId: string
  notice: string
  onPickTrip: (id: string) => void
  onNewTrip: () => void
  onOpen: (category: string, index: number) => void
}) {
  const hasPlaces = items.some(i => i.city === city && i.prefill.category !== 'food')
  return (
    <>
      <h2 className={styles.h2}>{city}</h2>
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      <div className={styles.panel}>
        <label className={styles.tripPick}>
          <span>Non-food places in {city} go into</span>
          <span className={styles.tripRow}>
            <select aria-label={`Trip for ${city}`} value={tripId} onChange={e => onPickTrip(e.target.value)}>
              <option value="">{hasPlaces ? 'Pick a trip' : 'Pick a trip (none needed yet)'}</option>
              {trips.map(t => <option key={t.id} value={t.id}>{t.name} · {placeLabel(t)}</option>)}
            </select>
            <button type="button" className="btn btn-quiet" onClick={onNewTrip}>New trip</button>
          </span>
        </label>
        <p className={styles.muted}>Food goes to Savorlog (the shared catalogue).</p>
      </div>
      <ul className={styles.cats}>
        {IMPORT_ORDER.map(key => {
          const list = categoryItems(items, city, key)
          const cat = categoryOf(key)!
          const t = tally(list)
          const first = nextPending(list, -1)
          return (
            <li key={key}>
              <button
                type="button"
                className={styles.catRow}
                disabled={list.length === 0}
                onClick={() => onOpen(key, first ?? 0)}
              >
                <span className={styles.dot} style={{ background: cat.color }} />
                <span className={styles.cityName}>{cat.label}</span>
                <span className={styles.count}>
                  {list.length === 0 ? 'none' : t.done === t.total ? `all ${t.total} done` : `${t.done} / ${t.total}`}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function CardView({
  userId, city, category, index, items, trip, catalogue, notice, onGo, onCity, onDone
}: {
  notice: string
  userId: string
  city: string
  category: string
  index: number
  items: ImportItem[]
  trip: TripSummary | undefined
  catalogue: Eatery[]
  onGo: (index: number, notice?: string) => void
  onCity: (notice?: string) => void
  onDone: (item: ImportItem, patch: Partial<ImportItem>) => void
}) {
  const list = categoryItems(items, city, category)
  const item = list[index]
  const catLabel = categoryOf(category)?.label ?? category
  const [asFood, setAsFood] = useState(category === 'food')
  const [place, setPlace] = useState<FoundPlace | null | undefined>(undefined)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoundPlace[]>([])
  const [searchErr, setSearchErr] = useState('')
  const [reviews, setReviews] = useState<EateryReview[]>([])
  const [err, setErr] = useState('')

  const existing = item ? catalogue.find(e => e.google_place_id === item.google_place_id) : undefined

  // A place already pinned on the chosen trip is ticked off automatically,
  // linked to that pin (Hanh, session 10: one pin per place per trip).
  const [tripPins, setTripPins] = useState<Pin[] | null>(null)
  const tripId = trip?.id
  useEffect(() => {
    setTripPins(null)
    if (tripId) fetchPins(tripId).then(setTripPins, () => setTripPins([]))
  }, [tripId])
  const pinned =
    item && item.status === 'pending' && !asFood && tripPins
      ? tripPins.find(p => p.google_place_id && (p.google_place_id === item.google_place_id || p.google_place_id === place?.id))
      : undefined
  const ticking = useRef(false)

  useEffect(() => {
    if (!item) return
    let alive = true
    setQuery(`${displayName(item)} ${city}`)
    placeById(item.google_place_id, { name: displayName(item), lat: item.lat, lng: item.lng }).then(p => alive && setPlace(p))
    return () => { alive = false }
  }, [item, city])
  useEffect(() => {
    if (existing) fetchEateryReviews([existing.id]).then(setReviews, () => setReviews([]))
  }, [existing])

  useEffect(() => {
    if (!pinned || !item || !trip || ticking.current) return
    ticking.current = true
    saved({ pin: pinned.id }, `${displayName(item)} was already on ${trip.name}, so it's ticked off.`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinned?.id])

  if (!item) return <p className="lede">Nothing here.</p>

  // On to the next place still waiting in this category, or back to the city.
  const goNext = (msg?: string) => {
    const fresh = list.map((x, i) => (i === index ? { ...x, status: 'saved' as const } : x))
    const n = nextPending(fresh, index)
    if (n === null) onCity([msg, `All ${catLabel} places in ${city} are done.`].filter(Boolean).join(' '))
    else onGo(n, msg)
  }
  async function saved(patch: { pin?: string; eatery?: string }, msg?: string) {
    if (!item) return
    try {
      await markSaved(item.id, patch)
      onDone(item, { status: 'saved', saved_pin_id: patch.pin ?? null, saved_eatery_id: patch.eatery ?? null })
      goNext(msg)
    } catch (e) {
      setErr(`Saved, but couldn't tick it off the import: ${(e as Error).message}`)
    }
  }
  const actions = {
    onSkip: async () => {
      try {
        await markSkipped(item.id)
        onDone(item, { status: 'skipped' })
        goNext()
      } catch (e) {
        setErr(`Couldn't skip: ${(e as Error).message}`)
      }
    },
    onBack: index > 0 ? () => onGo(index - 1) : undefined
  }

  const savesTo = asFood ? 'Savorlog' : trip ? trip.name : 'pick a trip for this city first'
  const old = item.copies

  return (
    <div className={styles.cardWrap}>
      <div className={styles.cardTop}>
        <button type="button" className={styles.linkBtn} onClick={() => onCity()}>‹ {city}</button>
        <span className={styles.position}>{catLabel} · {index + 1} of {list.length}</span>
        <span className={styles.savesTo}>Saves to: {savesTo}</span>
      </div>

      {notice && <p className={styles.notice} role="status">{notice}</p>}
      <div className={styles.old} aria-label="From old Wanderlog">
        <b>From old Wanderlog{old.length > 1 ? ` · ${old.length} copies` : ''}</b>
        <ul>
          {old.map((c, i) => (
            <li key={i}>
              “{c.name}” · {c.category}{c.icon ? ` · icon ${c.icon}` : ''} · {c.trip}
              {c.note ? <span className={styles.oldNote}> · note: {c.note}</span> : null}
            </li>
          ))}
        </ul>
        {item.prefill.michelin_url && (
          <p>MICHELIN Guide: <a href={item.prefill.michelin_url} target="_blank" rel="noreferrer">listing</a></p>
        )}
        {item.prefill.why && <p className={styles.why}>Claude's notes: {item.prefill.why}</p>}
        {existing && <p className={styles.flag}>Already in Savorlog — this opens the saved eatery to update.</p>}
      </div>

      {item.status !== 'pending' ? (
        <div className={styles.panel}>
          <p className={styles.panelHead}>{item.status === 'saved' ? 'Saved ✓' : 'Skipped for good'}</p>
          <div className={styles.navRow}>
            {index > 0 && <button type="button" className="btn btn-quiet" onClick={() => onGo(index - 1)}>‹ Back</button>}
            {index < list.length - 1 && <button type="button" className="btn btn-quiet" onClick={() => onGo(index + 1)}>Next ›</button>}
          </div>
        </div>
      ) : place === undefined ? (
        <p className="lede" role="status">Finding the place on Google…</p>
      ) : place === null ? (
        <div className={styles.panel}>
          <p className={styles.panelHead}>Google doesn't know the saved place any more. Pick it:</p>
          <form
            className={styles.search}
            onSubmit={async e => {
              e.preventDefault()
              setSearchErr('')
              try {
                setResults(await searchPlaces(query, { lat: item.lat, lng: item.lng }))
              } catch (x) {
                setSearchErr((x as Error).message)
              }
            }}
          >
            <input aria-label="Search Google" value={query} onChange={e => setQuery(e.target.value)} />
            <button type="submit" className="btn">Search</button>
          </form>
          {searchErr && <p className={styles.error}>{searchErr}</p>}
          <ul className={styles.results}>
            {results.map(r => (
              <li key={r.id}>
                <button type="button" onClick={() => setPlace(r)}><b>{r.name}</b> <span>{r.address}</span></button>
              </li>
            ))}
          </ul>
          <ImportSkipOnly onSkip={actions.onSkip} onBack={actions.onBack} />
        </div>
      ) : asFood ? (
        <>
          <SavorForm
            userId={userId}
            place={place}
            eatery={existing}
            reviews={existing ? reviews : []}
            prefill={{ ...item.prefill, category: 'food' }}
            importActions={actions}
            onCancel={() => onCity()}
            onSaved={id => saved({ eatery: id })}
          />
          {!existing && (
            <button type="button" className={styles.linkBtn} onClick={() => setAsFood(false)}>
              Not food? Add it as a trip place instead
            </button>
          )}
        </>
      ) : !trip ? (
        <div className={styles.panel}>
          <p className={styles.panelHead}>Pick the trip for {city} first.</p>
          <button type="button" className="btn btn-quiet" onClick={() => onCity()}>‹ {city}</button>
        </div>
      ) : (
        <PinForm
          tripId={trip.id}
          userId={userId}
          people={[]}
          place={place}
          reviews={[]}
          openDay={null}
          onAddToDay={() => undefined}
          onFood={() => setAsFood(true)}
          prefill={category === 'food' ? { ...item.prefill, category: '', sub: null, leaf: null } : item.prefill}
          importActions={actions}
          onCancel={() => onCity()}
          onSaved={id => saved({ pin: id })}
        />
      )}
      {err && <p className={styles.error} role="alert">{err}</p>}
      <PinPathNote item={item} />
    </div>
  )
}

/** Skip / Back for a place that can't be matched on Google yet. */
function ImportSkipOnly({ onSkip, onBack }: { onSkip: () => void; onBack?: () => void }) {
  const [asking, setAsking] = useState(false)
  return asking ? (
    <div className={styles.navRow} role="alert">
      <span>Skip this place for good? It won't come back.</span>
      <button type="button" className="btn" onClick={onSkip}>Skip</button>
      <button type="button" className="btn btn-quiet" onClick={() => setAsking(false)}>Keep</button>
    </div>
  ) : (
    <div className={styles.navRow}>
      <button type="button" className="btn btn-quiet" onClick={() => setAsking(true)}>Skip for good</button>
      {onBack && <button type="button" className="btn btn-quiet" onClick={onBack}>‹ Back</button>}
    </div>
  )
}

/** Claude's guess, in words, under the card (the card itself is editable). */
function PinPathNote({ item }: { item: ImportItem }) {
  const p = item.prefill
  const look = pinLook({ category: p.category, subcategory: p.sub, subsubcategory: p.leaf })
  return <p className={styles.muted}>Claude's guess: {look.label}</p>
}
