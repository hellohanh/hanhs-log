import { useState, type FormEvent } from 'react'
import { flowerSvg } from '../../lib/pinDraw'
import { searchPlaces, type FoundPlace, type Pin, type Review } from '../../lib/pins'
import type { Person } from '../../lib/trips'
import { type Eatery, type EateryReview } from '../../lib/eateries'
import type { StopKind } from '../../lib/itinerary'
import PinForm from './PinForm'
import PinTree from './PinTree'
import SavorForm from '../savor/SavorForm'
import EateryTree from '../savor/EateryTree'
import styles from './Places.module.css'

// The Places panel (left of the map). Pins are the trip's non-food places;
// dining lives in Savorlog, so the Nom-Nom section shows the catalogue's
// eateries within 20 km of the trip's cities (M5), and picking Nom-Nom while
// adding hands off to the full Savorlog add panel.

export type Editing = { mode: 'add'; place: FoundPlace } | { mode: 'edit'; pinId: string } | null
export type EateryEditing = { mode: 'add'; place: FoundPlace } | { mode: 'edit'; id: string } | null

export default function PlacesPanel({
  tripId,
  userId,
  people,
  pins,
  reviews,
  eateries,
  eateryReviews,
  loadError,
  showAll,
  onShowAll,
  picked,
  onPick,
  michelinOnly,
  onMichelinOnly,
  editing,
  onEditing,
  eateryEdit,
  onEateryEdit,
  onSaved,
  onEateriesSaved,
  onFocus,
  onOpenPlace,
  near,
  openDay,
  onAddToDay
}: {
  tripId: string
  userId: string
  people: Person[]
  pins: Pin[]
  reviews: Review[]
  eateries: Eatery[]
  eateryReviews: EateryReview[]
  loadError: string
  showAll: boolean
  onShowAll: (on: boolean) => void
  picked: Set<string>
  onPick: (ids: string[]) => void
  michelinOnly: boolean
  onMichelinOnly: (on: boolean) => void
  editing: Editing
  onEditing: (e: Editing) => void
  eateryEdit: EateryEditing
  onEateryEdit: (e: EateryEditing) => void
  onSaved: (focusPinId?: string) => void
  onEateriesSaved: () => void
  onFocus: (at: { lat: number; lng: number }) => void
  /** A list click opens the map popup (session 10); absent → the edit panel. */
  onOpenPlace?: (kind: 'pin' | 'eatery', item: { id: string; lat: number; lng: number }) => void
  near?: { lat: number; lng: number }
  /** The itinerary's open day, for "Add to day" and drag; null when it's closed. */
  openDay: { id: string; label: string } | null
  onAddToDay: (id: string, kind: StopKind) => void
}) {
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<FoundPlace[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  const hasMichelin = pins.some(p => p.michelin) || eateries.some(e => e.michelin)
  const michelinCount = pins.filter(p => p.michelin).length + eateries.filter(e => e.michelin).length

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
    const eatery = eateries.find(x => x.google_place_id === place.id)
    if (eatery) return onEateryEdit({ mode: 'edit', id: eatery.id })
    const pin = pins.find(p => p.google_place_id === place.id)
    if (pin) {
      onFocus(pin)
      return onEditing({ mode: 'edit', pinId: pin.id })
    }
    onEditing({ mode: 'add', place })
  }

  // Adding or editing an eatery (the Savorlog add panel, reused whole).
  if (eateryEdit) {
    const eatery = eateryEdit.mode === 'edit' ? eateries.find(e => e.id === eateryEdit.id) : undefined
    if (eateryEdit.mode === 'edit' && !eatery) return null
    return (
      <aside className={styles.side} aria-label="Places">
        <SavorForm
          key={eateryEdit.mode === 'edit' ? eateryEdit.id : eateryEdit.place.id}
          userId={userId}
          place={eateryEdit.mode === 'add' ? eateryEdit.place : undefined}
          eatery={eatery}
          reviews={eatery ? eateryReviews.filter(r => r.eatery_id === eatery.id) : []}
          onCancel={() => onEateryEdit(null)}
          onSaved={() => {
            onEateryEdit(null)
            onEateriesSaved()
          }}
        />
      </aside>
    )
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
          onFood={editing.mode === 'add' ? () => { const place = editing.place; onEditing(null); onEateryEdit({ mode: 'add', place }) } : undefined}
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

  const total = pins.length + eateries.length
  return (
    <aside className={styles.side} aria-label="Places">
      <div className={styles.head}>
        <strong>Places</strong>
        <span className={styles.count}>{total > 0 ? total : ''}</span>
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
            const already = pins.some(p => p.google_place_id === f.id) || eateries.some(e => e.google_place_id === f.id)
            return (
              <li key={f.id}>
                <button type="button" className={styles.result} onClick={() => pick(f)}>
                  <b>{f.name}</b>
                  {f.address && <span>{f.address}</span>}
                  {already && <em>Already added · open it</em>}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {total > 0 && (
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
      {total === 0 && !loadError && !found && (
        <p className={styles.muted}>No places on this trip yet. Search above to add one.</p>
      )}

      {pins.length > 0 && (
        <div className={styles.list}>
          <PinTree
            pins={pins}
            reviews={reviews}
            openDay={openDay}
            onOpen={p => {
              if (onOpenPlace) return onOpenPlace('pin', p)
              onFocus(p)
              onEditing({ mode: 'edit', pinId: p.id })
            }}
            onAddToDay={onAddToDay}
            picked={picked}
            showAll={showAll}
            onPick={onPick}
          />
        </div>
      )}

      {eateries.length > 0 && (
        <div className={styles.list}>
          <div className={styles.cat}>
            <span className={styles.catDot} style={{ background: '#D85A30' }} />
            <strong style={{ fontSize: 14 }}>Nom-Nom</strong>
            <span className={styles.fromSavor}>from Savorlog</span>
          </div>
          <EateryTree
            eateries={eateries}
            reviews={eateryReviews}
            openDay={openDay}
            onOpen={e => {
              if (onOpenPlace) return onOpenPlace('eatery', e)
              onFocus(e)
              onEateryEdit({ mode: 'edit', id: e.id })
            }}
            onAddToDay={onAddToDay}
            picked={picked}
            showAll={showAll}
            onPick={onPick}
          />
        </div>
      )}
    </aside>
  )
}
