import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { isSupabaseConfigured } from '../../lib/supabase'
import { fetchCatalogue, fetchEateryReviews, claimSavorlog, asReviews, priceLabel, type Eatery, type EateryReview } from '../../lib/eateries'
import { searchLocations, resolveScope, inScope, type LocationHit, type Scope } from '../../lib/savorLocation'
import { buildCountryTree } from '../../lib/savorTree'
import { pinLook } from '../../lib/pinCatalog'
import { pinBox, pinHtml, badgeSvg, flowerSvg, BADGE } from '../../lib/pinDraw'
import { pinBadge, pinFaded, averageRating } from '../../lib/pinRules'
import SavorMap, { type Frame } from './SavorMap'
import { type MapPin } from '../wander/mapPinLayer'
import styles from './Savor.module.css'

// The Savorlog page (/savor): a required location gate (E66) scopes the page to
// a country or a city, then the shared eatery catalogue by country → dish on
// the left and the chosen place on one map. Adding / editing an eatery is 4d.

const asLook = (e: Eatery) => ({ category: 'food', subcategory: e.cuisine, subsubcategory: e.dish })

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
  return <SavorLoaded />
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

function SavorLoaded() {
  const [eateries, setEateries] = useState<Eatery[]>([])
  const [reviews, setReviews] = useState<EateryReview[]>([])
  const [error, setError] = useState('')
  const [showAll, setShowAll] = useState(true)
  const [michelinOnly, setMichelinOnly] = useState(false)
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set())
  const [openId, setOpenId] = useState<string | null>(null)
  // The location gate: null until a country/city is chosen (asked every visit).
  const [scope, setScope] = useState<Scope | null>(null)

  const load = useCallback(async () => {
    try {
      await claimSavorlog().catch(() => {}) // best-effort: become owner if the circle is empty
      const es = await fetchCatalogue()
      setEateries(es)
      setReviews(await fetchEateryReviews(es.map(e => e.id)))
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const shown = useMemo(() => (scope ? eateries.filter(e => inScope(e, scope)) : []), [eateries, scope])
  const tree = useMemo(() => buildCountryTree(shown), [shown])
  const hasMichelin = shown.some(e => e.michelin)
  const michelinCount = shown.filter(e => e.michelin).length
  const frame: Frame | null = scope ? (scope.kind === 'country' ? { bounds: scope.bounds, center: scope.center } : { center: scope.center, zoom: 13 }) : null

  const mapPins = useMemo<MapPin[]>(
    () =>
      shown.map(e => {
        const look = pinLook(asLook(e))
        const box = pinBox(e)
        return {
          id: e.id,
          lat: e.lat,
          lng: e.lng,
          title: `${e.name} (${look.label})`,
          html: pinHtml({ color: look.color, icon: look.icon, michelin: e.michelin, badge: pinBadge(asReviews(reviews, e.id)) }),
          width: box.width,
          height: box.height,
          faded: pinFaded({ id: e.id, michelin: e.michelin }, { editing: false, otdPins: null, showAll, michelinOnly })
        }
      }),
    [shown, reviews, showAll, michelinOnly]
  )

  const toggle = (key: string) =>
    setOpenKeys(s => {
      const next = new Set(s)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  const openEatery = (e: Eatery) => setOpenId(e.id)
  const chooseScope = (s: Scope) => {
    setScope(s)
    setOpenKeys(new Set())
    setOpenId(null)
  }

  const open = openId ? shown.find(e => e.id === openId) ?? null : null

  return (
    <main className={`segoe ${styles.page}`}>
      <div className={styles.bar}>
        <div className={styles.titles}>
          <p className={styles.eyebrow}>Savorlog</p>
          <h1 className={styles.h1}>Eateries</h1>
        </div>
        {scope && (
          <div className={styles.where}>
            Showing <b>{scope.name}</b> {scope.kind === 'city' ? '(city)' : '(country)'}
            <button type="button" className={styles.change} onClick={() => setScope(null)}>Change</button>
          </div>
        )}
      </div>
      <div className={styles.body}>
        <aside className={styles.side} aria-label="Catalogue">
          {open ? (
            <Peek eatery={open} reviews={asReviews(reviews, open.id)} onClose={() => setOpenId(null)} />
          ) : (
            <>
              <div className={styles.head}>
                <strong>Catalogue</strong>
                <span className={styles.count}>{shown.length > 0 ? shown.length : ''}</span>
              </div>
              {error && <p className={styles.error} role="alert">Couldn't load the catalogue: {error}</p>}
              {scope && shown.length > 0 && (
                <div className={styles.filters}>
                  <label className={styles.showAll}>
                    <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> Show all
                  </label>
                  {hasMichelin && (
                    <button type="button" className={styles.chip} aria-pressed={michelinOnly} onClick={() => setMichelinOnly(v => !v)} title="Show only MICHELIN eateries on the map">
                      <span dangerouslySetInnerHTML={{ __html: flowerSvg(13, '#9E2A2B') }} /> MICHELIN {michelinCount}
                    </button>
                  )}
                </div>
              )}
              {scope && shown.length === 0 && !error && (
                <p className={styles.muted}>No eateries in {scope.name} yet.</p>
              )}
              {scope && shown.length > 0 && (
                <ul className={styles.tree}>
                  {tree.map(c => {
                    const openC = openKeys.has(c.key)
                    return (
                      <li key={c.key}>
                        <button type="button" className={styles.node} aria-expanded={openC} onClick={() => toggle(c.key)}>
                          <span className={styles.arrow} aria-hidden="true">{openC ? '▾' : '▸'}</span>
                          <span className={styles.dot} style={{ background: c.color }} />
                          <span className={styles.name}>{c.label}</span>
                          <span className={styles.cnt}>{c.count}</span>
                        </button>
                        {openC && (
                          <ul className={styles.tree} style={{ paddingLeft: 22 }}>
                            {c.loose.map(e => (
                              <EateryRow key={e.id} e={e} reviews={reviews} onOpen={openEatery} />
                            ))}
                            {c.dishes.map(d => {
                              const dk = `${c.key}/${d.key}`
                              const openD = openKeys.has(dk)
                              return (
                                <li key={dk}>
                                  <button type="button" className={styles.node} aria-expanded={openD} onClick={() => toggle(dk)}>
                                    <span className={styles.arrow} aria-hidden="true">{openD ? '▾' : '▸'}</span>
                                    <span className={`${styles.name} ${styles.dish}`}>{d.label}</span>
                                    <span className={styles.cnt}>{d.count}</span>
                                  </button>
                                  {openD && (
                                    <ul className={styles.tree} style={{ paddingLeft: 22 }}>
                                      {d.eateries.map(e => (
                                        <EateryRow key={e.id} e={e} reviews={reviews} onOpen={openEatery} />
                                      ))}
                                    </ul>
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}
        </aside>
        <div className={styles.mapArea}>
          <SavorMap pins={mapPins} frame={frame} onPinClick={id => { const e = shown.find(x => x.id === id); if (e) openEatery(e) }} />
        </div>
      </div>
      {!scope && <LocationPicker onPick={h => chooseScope(resolveScope(h))} />}
    </main>
  )
}

function LocationPicker({ onPick }: { onPick: (hit: LocationHit) => void }) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<LocationHit[]>([])
  const [searching, setSearching] = useState(false)
  const [err, setErr] = useState('')
  const seq = useRef(0)

  function run(q: string) {
    setQuery(q)
    const n = ++seq.current
    if (!q.trim()) {
      setHits([])
      setErr('')
      return
    }
    setSearching(true)
    searchLocations(q).then(
      r => { if (n === seq.current) { setHits(r); setErr(''); setSearching(false) } },
      e => { if (n === seq.current) { setHits([]); setErr((e as Error).message); setSearching(false) } }
    )
  }

  return (
    <div className={styles.scrim}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Where to see eateries">
        <h2 className={styles.modalH}>Where do you want to see eateries?</h2>
        <p className={styles.modalP}>Pick a country or a city — the catalogue and the map show that place.</p>
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
        <p className={styles.req}>A country or city is required to open Savorlog.</p>
      </div>
    </div>
  )
}

function EateryRow({ e, reviews, onOpen }: { e: Eatery; reviews: EateryReview[]; onOpen: (e: Eatery) => void }) {
  const badge = pinBadge(asReviews(reviews, e.id))
  return (
    <li className={styles.rowLi}>
      <button type="button" className={styles.row} onClick={() => onOpen(e)}>
        <span className={styles.status} title={BADGE[badge].label} aria-label={BADGE[badge].label} role="img" dangerouslySetInnerHTML={{ __html: badgeSvg(badge, 12) }} />
        <span className={styles.name}>{e.name}</span>
        {e.michelin && (
          <span className={styles.mich} title={e.michelin === 'mentioned' ? 'MICHELIN' : `MICHELIN ${e.michelin} star${e.michelin === '1' ? '' : 's'}`}>
            {e.michelin === 'mentioned' ? <span dangerouslySetInnerHTML={{ __html: flowerSvg(12, '#9E2A2B') }} /> : '★'.repeat(Number(e.michelin))}
          </span>
        )}
        {e.price != null && <span className={styles.price}>{priceLabel(e.price)}</span>}
      </button>
    </li>
  )
}

function Peek({ eatery, reviews, onClose }: { eatery: Eatery; reviews: ReturnType<typeof asReviews>; onClose: () => void }) {
  const look = pinLook(asLook(eatery))
  const badge = pinBadge(reviews)
  const avg = averageRating(reviews)
  return (
    <div className={styles.peek}>
      <div className={styles.peekHead}>
        <strong>{eatery.name}</strong>
        <button type="button" className={styles.x} aria-label="Close" onClick={onClose}>×</button>
      </div>
      <p className={styles.path}>{look.label}</p>
      <div className={styles.marks}>
        <span className={styles.status} title={BADGE[badge].label} aria-label={BADGE[badge].label} role="img" dangerouslySetInnerHTML={{ __html: badgeSvg(badge, 14) }} />
        <span>{BADGE[badge].label}</span>
        {eatery.michelin && (
          <span className={styles.mich}>
            {eatery.michelin === 'mentioned' ? <span dangerouslySetInnerHTML={{ __html: flowerSvg(13, '#9E2A2B') }} /> : '★'.repeat(Number(eatery.michelin))}
            {eatery.michelin_year ? ` ${eatery.michelin_year}` : ''}
          </span>
        )}
        {eatery.price != null && <span className={styles.price}>{priceLabel(eatery.price)}</span>}
        {eatery.street_food && <span className={styles.tag}>Street food</span>}
        {eatery.fine_dining && <span className={styles.tag}>Fine dining</span>}
      </div>
      {eatery.address && <p className={styles.path}>{eatery.address}</p>}
      {eatery.note && <p className={styles.note}>{eatery.note}</p>}
      <p className={styles.avg}>{avg != null ? `Average rating ${avg} / 5 (${reviews.filter(r => r.rating != null).length})` : 'No ratings yet'}</p>
      <p className={styles.muted} style={{ fontSize: 12 }}>Adding your own rating and editing come in the next step.</p>
    </div>
  )
}
