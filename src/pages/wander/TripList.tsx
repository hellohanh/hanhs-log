import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useIsPhone } from '../../lib/usePhone'
import { setPageMenu, type PageMenuItem } from '../../lib/pageMenu'
import { useAuth } from '../../lib/auth'
import { isSupabaseConfigured } from '../../lib/supabase'
import {
  createTrip,
  deleteTrip,
  updateTrip,
  fetchPeopleCounts,
  fetchTrips,
  splitTrips,
  todayISO,
  placeLabel,
  tripDates,
  createTripBundle,
  fetchMyBundles,
  type TripBundle,
  type TripSummary
} from '../../lib/trips'
import { BundlesDialog, NewBundleDialog } from './BundleDialogs'
import { ensureTripCity } from '../../lib/city'
import { amSavorlogOwner, fetchImport } from '../../lib/pinImport'
import TripForm from './TripForm'
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
  // Edit a trip straight from its card (session 9), same popup as inside the trip.
  const [editingTrip, setEditingTrip] = useState<TripSummary | null>(null)
  const [notice, setNotice] = useState('')
  const [people, setPeople] = useState<Record<string, number>>({})
  // One invite link for several trips (session 14): pick mode, the new link, your links.
  const [picking, setPicking] = useState<Set<string> | null>(null)
  const [newBundle, setNewBundle] = useState<{ token: string; tripIds: string[] } | null>(null)
  const [bundles, setBundles] = useState<TripBundle[]>([])
  const [showBundles, setShowBundles] = useState(false)
  const loadBundles = useCallback(() => { fetchMyBundles().then(setBundles, () => setBundles([])) }, [])
  useEffect(() => { loadBundles() }, [loadBundles])
  // The import button shows only to the Savorlog owner (E71), with places left.
  const [importLeft, setImportLeft] = useState<number | null>(null)
  const today = todayISO()

  useEffect(() => {
    let alive = true
    amSavorlogOwner()
      .then(async owner => {
        if (!owner || !alive) return
        const items = await fetchImport().catch(() => [])
        if (alive) setImportLeft(items.length ? items.filter(i => i.status === 'pending').length : -1)
      })
      .catch(() => undefined)
    return () => { alive = false }
  }, [])

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

  const phone = useIsPhone()
  const navigate = useNavigate()
  const startPicking = () => { setNotice('Tick the trips you own to put on one invite link.'); setPicking(new Set()) }
  const menuItems: PageMenuItem[] = [
    ...(bundles.length > 0 ? [{ label: 'Several-trips links', sub: String(bundles.length), onSelect: () => setShowBundles(true) }] : []),
    { label: 'Invite to several trips', onSelect: startPicking },
    ...(importLeft !== null ? [{ label: 'Import old pins', sub: importLeft >= 0 ? `${importLeft} left` : undefined, onSelect: () => navigate('/wander/import') }] : [])
  ]
  // On phones these go in the site's ☰ menu while Your trips is open.
  const menuKey = menuItems.map(i => `${i.label}:${i.sub ?? ''}`).join('|')
  const menuRef = useRef(menuItems)
  menuRef.current = menuItems
  useEffect(() => {
    if (!phone) return
    setPageMenu(menuRef.current.map(i => ({ ...i, onSelect: () => menuRef.current.find(x => x.label === i.label)?.onSelect?.() })))
    return () => setPageMenu([])
  }, [phone, menuKey])

  return (
    <Shell
      action={
        !creating && picking ? (
          <span className={styles.actions}>
            <button type="button" className={`btn btn-quiet ${styles.newBtn}`} onClick={() => setPicking(null)}>Cancel</button>
            <button type="button" className={`btn ${styles.newBtn}`} disabled={picking.size === 0} onClick={async () => {
              const ids = [...picking]
              try {
                const token = await createTripBundle(ids)
                setPicking(null)
                setNewBundle({ token, tripIds: ids })
                loadBundles()
              } catch (e) {
                setNotice(`Couldn't make the link: ${(e as Error).message}`)
              }
            }}>
              Make one link · {picking.size} trip{picking.size === 1 ? '' : 's'}
            </button>
          </span>
        ) : !creating && (
          <span className={styles.actions}>
            <button type="button" className={`btn ${styles.newBtn}`} onClick={() => setCreating(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New trip
            </button>
            {/* Session 15 (approved mockup): the other actions sit in a ☰
                beside + New trip; on phones they're in the site's ☰ menu. */}
            {!phone && menuItems.length > 0 && <TripsMenu items={menuItems} />}
          </span>
        )
      }
    >
      {creating && (
        <NewTripDialog
          userId={userId}
          onCancel={() => setCreating(false)}
          onCreated={async name => {
            setCreating(false)
            setNotice(`Created "${name}".`)
            await reload()
          }}
        />
      )}

      {editingTrip && (
        <EditTripDialog
          trip={editingTrip}
          onCancel={() => setEditingTrip(null)}
          onSaved={async name => {
            setEditingTrip(null)
            setNotice(`Saved "${name}".`)
            await reload()
          }}
        />
      )}

      {newBundle && load.state === 'ready' && (
        <NewBundleDialog token={newBundle.token} tripIds={newBundle.tripIds} trips={load.trips} onClose={() => setNewBundle(null)} />
      )}
      {showBundles && load.state === 'ready' && (
        <BundlesDialog bundles={bundles} trips={load.trips} onChanged={loadBundles} onClose={() => setShowBundles(false)} />
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
            <p className="lede">
              {groups.past.length === 0
                ? 'No trips yet. Your trips from the old Wanderlog stay there; start fresh here with New trip.'
                : 'No upcoming trips yet. Start one with New trip.'}
            </p>
          ) : (
            <ul className={styles.grid}>
              {groups.upcoming.map(t => (
                <TripCard key={t.id} trip={t} today={today} mine={t.owner_id === userId} people={people[t.id]} onDelete={remove} onEdit={setEditingTrip}
                  pick={picking ? { checked: picking.has(t.id), onToggle: () => setPicking(p => { const n = new Set(p); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n }) } : undefined} />
              ))}
            </ul>
          )}

          {groups.past.length > 0 && (
            <>
              <h2 className={`${styles.h2} ${styles.pastTitle}`}>Past</h2>
              <ul className={`${styles.grid} ${styles.past}`}>
                {groups.past.map(t => (
                  <TripCard key={t.id} trip={t} today={today} mine={t.owner_id === userId} people={people[t.id]} onDelete={remove} onEdit={setEditingTrip}
                  pick={picking ? { checked: picking.has(t.id), onToggle: () => setPicking(p => { const n = new Set(p); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n }) } : undefined} />
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
  onDelete,
  onEdit,
  pick
}: {
  trip: TripSummary
  today: string
  mine: boolean
  people?: number
  onDelete: (t: TripSummary) => void
  onEdit: (t: TripSummary) => void
  /** Pick mode for one invite link (session 14): a tick box on trips you own. */
  pick?: { checked: boolean; onToggle: () => void }
}) {
  const dates = tripDates(trip.start_date, trip.end_date, today)
  const dated = !!(trip.start_date || trip.end_date)
  return (
    <li className={styles.card} data-testid="trip-card" style={pick && !mine ? { opacity: 0.45 } : undefined}>
      {pick && mine && (
        <label className={styles.pick}>
          <input type="checkbox" checked={pick.checked} onChange={pick.onToggle} aria-label={`Include ${trip.name}`} />
        </label>
      )}
      <span className={dated ? styles.dates : `${styles.dates} ${styles.undated}`}>{dates}</span>
      <Link to={`/wander/trip/${trip.id}`} className={styles.name}>{trip.name}</Link>
      <span className={styles.destination}>{placeLabel(trip)}</span>
      <span className={styles.foot}>
        <span>
          {/* Since session 14 only food pins belong to a trip (the rest are
              Roaminglog spots on every trip), so 0 isn't worth saying. */}
          {[trip.pinCount === 0 ? '' : trip.pinCount === 1 ? '1 pin' : `${trip.pinCount} pins`,
            people === undefined ? '' : people <= 1 ? 'just you' : `${people} people`].filter(Boolean).join(' · ')}
        </span>
        <span className={styles.footRight}>
          <span className={styles.badge}>{mine ? 'You own this' : 'Shared with you'}</span>
          <button type="button" className={styles.delete} aria-label={`Edit ${trip.name}`} title="Edit trip" onClick={() => onEdit(trip)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />
            </svg>
          </button>
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

// New trip opens as a popup over the list (approved mockup, session 4).
// Also used by the import queue's "New trip" (E71).
export function NewTripDialog({
  userId,
  onCancel,
  onCreated
}: {
  userId: string
  onCancel: () => void
  onCreated: (name: string, id: string) => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className={styles.scrim} onMouseDown={e => e.target === e.currentTarget && onCancel()}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label="New trip">
        <TripForm
          title="New trip"
          submitLabel="Create trip"
          busyLabel="Creating…"
          onCancel={onCancel}
          onSubmit={async (trip, map) => {
            const id = await createTrip(trip, userId, map)
            // No match shown before saving: look the city up now (best effort).
            if (!map) ensureTripCity(id, trip).catch(() => undefined)
            onCreated(trip.name, id)
          }}
        />
      </div>
    </div>
  )
}

// Edit trip from the list (session 9): the same form as Edit trip on the trip page.
function EditTripDialog({ trip, onCancel, onSaved }: { trip: TripSummary; onCancel: () => void; onSaved: (name: string) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className={styles.scrim} onMouseDown={e => e.target === e.currentTarget && onCancel()}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label="Edit trip">
        <TripForm
          title="Edit trip"
          initial={trip}
          submitLabel="Save"
          busyLabel="Saving…"
          onCancel={onCancel}
          onSubmit={async (fields, map) => {
            await updateTrip(trip.id, fields, map)
            if (!map) ensureTripCity(trip.id, fields).catch(() => undefined)
            onSaved(fields.name)
          }}
        />
      </div>
    </div>
  )
}

// The ☰ beside + New trip on computers (session 15, approved mockup): the
// several-trips links, inviting to several trips, and the old-pin import.
function TripsMenu({ items }: { items: PageMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', down, true)
    window.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', down, true); window.removeEventListener('keydown', key) }
  }, [open])
  const importAt = items.findIndex(i => i.label === 'Import old pins')
  return (
    <span ref={box} className={styles.menuWrap}>
      <button type="button" className={styles.menuBtn} aria-label="More trip actions" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      {open && (
        <span className={styles.menu} role="menu">
          {items.map((i, n) => (
            <span key={i.label} style={{ display: 'contents' }}>
              {n === importAt && n > 0 && <hr className={styles.menuRule} />}
              <button type="button" role="menuitem" className={styles.menuItem} onClick={() => { setOpen(false); i.onSelect?.() }}>
                <span>{i.label}</span>
                {i.sub && <span className={styles.left}>{i.sub}</span>}
              </button>
            </span>
          ))}
        </span>
      )}
    </span>
  )
}
