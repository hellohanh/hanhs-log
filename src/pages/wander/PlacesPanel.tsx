import { useMemo, useState, type FormEvent } from 'react'
import { CATEGORIES } from '../../lib/pinCatalog'
import { flowerSvg } from '../../lib/pinDraw'
import { BADGE } from '../../lib/pinDraw'
import { pinBadge, searchPlaces, type FoundPlace, type Pin, type Review } from '../../lib/pins'
import type { Person } from '../../lib/trips'
import PinForm from './PinForm'
import styles from './Places.module.css'

// The Places panel (left of the map; approved mockups, session 4):
// - a Google search box to find a place to pin (the only way to add one);
// - "Show all pins": on by default, every visit; off fades all the trip's
//   pins on the map to 10% (the list never fades);
// - a MICHELIN chip (only when a pin has MICHELIN) that fades the others;
// - the pins, grouped by category, a category showing only when it has pins
//   (the full three-level tree is step 5);
// - the add / edit card in place of the list.

export type Editing = { mode: 'add'; place: FoundPlace } | { mode: 'edit'; pinId: string } | null

export default function PlacesPanel({
  tripId,
  userId,
  people,
  pins,
  reviews,
  loadError,
  showAll,
  onShowAll,
  michelinOnly,
  onMichelinOnly,
  editing,
  onEditing,
  onSaved,
  onFocus,
  near,
  openDay,
  onAddToDay
}: {
  tripId: string
  userId: string
  people: Person[]
  pins: Pin[]
  reviews: Review[]
  loadError: string
  showAll: boolean
  onShowAll: (on: boolean) => void
  michelinOnly: boolean
  onMichelinOnly: (on: boolean) => void
  editing: Editing
  onEditing: (e: Editing) => void
  onSaved: (focusPinId?: string) => void
  onFocus: (at: { lat: number; lng: number }) => void
  near?: { lat: number; lng: number }
  /** The itinerary's open day, for "Add to day" and drag; null when it's closed. */
  openDay: { id: string; label: string } | null
  onAddToDay: (pinId: string) => void
}) {
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<FoundPlace[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  const byCategory = useMemo(
    () => CATEGORIES.map(c => ({ c, list: pins.filter(p => p.category === c.key) })).filter(g => g.list.length > 0),
    [pins]
  )
  const hasMichelin = pins.some(p => p.michelin)
  const michelinCount = pins.filter(p => p.michelin).length

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
    const already = pins.find(p => p.google_place_id === place.id)
    setFound(null)
    setQuery('')
    if (already) {
      onFocus(already)
      onEditing({ mode: 'edit', pinId: already.id })
    } else onEditing({ mode: 'add', place })
  }

  if (editing) {
    const pin = editing.mode === 'edit' ? pins.find(p => p.id === editing.pinId) : undefined
    if (editing.mode === 'edit' && !pin) return null
    return (
      <aside className={styles.side} aria-label="Places">
        <PinForm
          key={editing.mode === 'edit' ? editing.pinId : editing.place.id}
          tripId={tripId}
          userId={userId}
          people={people}
          place={editing.mode === 'add' ? editing.place : undefined}
          pin={pin}
          reviews={pin ? reviews.filter(r => r.pin_id === pin.id) : []}
          openDay={openDay}
          onAddToDay={onAddToDay}
          onCancel={() => onEditing(null)}
          onSaved={id => {
            if (editing.mode === 'add') onFocus(editing.place)
            onEditing(null)
            onSaved(id)
          }}
        />
      </aside>
    )
  }

  return (
    <aside className={styles.side} aria-label="Places">
      <div className={styles.head}>
        <strong>Places</strong>
        <span className={styles.count}>{pins.length > 0 ? pins.length : ''}</span>
      </div>

      <form className={styles.search} role="search" onSubmit={search}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input
          type="search"
          value={query}
          onChange={e => {
            setQuery(e.target.value)
            if (!e.target.value) setFound(null)
          }}
          placeholder="Search Google to add a place"
          aria-label="Search Google for a place to add"
        />
        <button type="submit" className={styles.go} disabled={searching}>{searching ? '…' : 'Search'}</button>
      </form>
      {searchError && <p className={styles.error} role="alert">{searchError}</p>}
      {found && (
        <ul className={styles.results} aria-label="Search results">
          {found.length === 0 && <li className={styles.muted}>Nothing found. Try other words.</li>}
          {found.map(f => {
            const already = pins.some(p => p.google_place_id === f.id)
            return (
              <li key={f.id}>
                <button type="button" className={styles.result} onClick={() => pick(f)}>
                  <b>{f.name}</b>
                  {f.address && <span>{f.address}</span>}
                  {already && <em>Already pinned · open it</em>}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {pins.length > 0 && (
        <div className={styles.filters}>
          <label className={styles.showAll}>
            <input type="checkbox" checked={showAll} onChange={e => onShowAll(e.target.checked)} /> Show all pins
          </label>
          {hasMichelin && (
            <button type="button" className={styles.chip} aria-pressed={michelinOnly} onClick={() => onMichelinOnly(!michelinOnly)} title="Show only MICHELIN places on the map">
              <span dangerouslySetInnerHTML={{ __html: flowerSvg(13, '#9E2A2B') }} />
              MICHELIN {michelinCount}
            </button>
          )}
        </div>
      )}

      {loadError && <p className={styles.error} role="alert">Couldn't load the pins: {loadError}</p>}
      {pins.length === 0 && !loadError && !found && (
        <p className={styles.muted}>No places on this trip yet. Search above to add one.</p>
      )}

      <div className={styles.list}>
        {byCategory.map(({ c, list }) => (
          <section key={c.key} aria-label={c.label}>
            <h3 className={styles.cat}>
              <span className={styles.catDot} style={{ background: c.color }} />
              {c.label}
              <span className={styles.count}>{list.length}</span>
            </h3>
            <ul className={styles.rows}>
              {list.map(p => {
                const badge = pinBadge(reviews.filter(r => r.pin_id === p.id))
                return (
                  <li key={p.id} className={styles.rowLi}>
                    <button
                      type="button"
                      className={styles.row}
                      draggable
                      onDragStart={e => {
                        e.dataTransfer.setData('text/plain', p.id)
                        e.dataTransfer.effectAllowed = 'copy'
                      }}
                      onClick={() => {
                        onFocus(p)
                        onEditing({ mode: 'edit', pinId: p.id })
                      }}
                    >
                      <span className={styles.status} style={{ background: BADGE[badge].fill }} title={BADGE[badge].label} aria-label={BADGE[badge].label} role="img" />
                      <span className={styles.name}>{p.name}</span>
                      {p.michelin && (
                        <span className={styles.mich} title={p.michelin === 'mentioned' ? 'MICHELIN' : `MICHELIN ${p.michelin} star${p.michelin === '1' ? '' : 's'}`}>
                          {p.michelin === 'mentioned' ? <span dangerouslySetInnerHTML={{ __html: flowerSvg(12, '#9E2A2B') }} /> : '★'.repeat(Number(p.michelin))}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      className={styles.addDay}
                      disabled={!openDay}
                      onClick={() => openDay && onAddToDay(p.id)}
                      aria-label={openDay ? `Add ${p.name} to ${openDay.label}` : 'Add to a day — open the itinerary first'}
                      title={openDay ? `Add to ${openDay.label}` : 'Add to a day — open the itinerary first'}
                    >
                      +
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  )
}
