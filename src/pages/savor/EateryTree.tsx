import { useState } from 'react'
import { buildCountryTree } from '../../lib/savorTree'
import { asReviews, priceLabel, type Eatery, type EateryReview } from '../../lib/eateries'
import { stopRef } from '../../lib/itinerary'
import { badgeSvg, bibFaceSvg, flowerSvg, BADGE } from '../../lib/pinDraw'
import { isStarred, michelinWords } from '../../lib/vibe'
import { eyeState, pinBadge } from '../../lib/pinRules'
import EyeButton from '../../components/EyeButton'
import styles from './Savor.module.css'

// The catalogue as a country → dish collapsible tree (E65), shared by the
// Savorlog page and — for the eateries a trip shows by city — the Wanderlog
// Places panel (M5). Collapsed every visit; opening a row calls onOpen. On a
// trip (openDay/onAddToDay given) a row is draggable onto the itinerary and
// carries a "+" to add it to the open day, like the pinned list's pins.
export default function EateryTree({
  eateries,
  reviews,
  openDay,
  onOpen,
  onAddToDay,
  picked,
  showAll,
  onPick,
  onEdit
}: {
  eateries: Eatery[]
  reviews: EateryReview[]
  openDay?: { id: string; label: string } | null
  onOpen: (e: Eatery) => void
  onAddToDay?: (id: string, kind: 'eatery') => void
  /** The eyes (session 10): which eateries show while Show all is off. */
  picked: Set<string>
  showAll: boolean
  onPick: (ids: string[]) => void
  /** Double-click an eatery → its edit panel (computer, session 14). */
  onEdit?: (e: Eatery) => void
}) {
  const tree = buildCountryTree(eateries)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (k: string) =>
    setOpen(s => {
      const n = new Set(s)
      n.has(k) ? n.delete(k) : n.add(k)
      return n
    })

  const canSchedule = !!onAddToDay
  const row = (e: Eatery) => {
    const badge = pinBadge(asReviews(reviews, e.id))
    return (
      <li key={e.id} className={styles.rowLi}>
        <button
          type="button"
          className={styles.row}
          draggable={canSchedule}
          onDragStart={canSchedule ? ev => { ev.dataTransfer.setData('text/plain', stopRef('eatery', e.id)); ev.dataTransfer.effectAllowed = 'copy' } : undefined}
          onClick={() => onOpen(e)}
          onDoubleClick={onEdit ? () => onEdit(e) : undefined}
        >
          <span className={styles.status} title={BADGE[badge].label} aria-label={BADGE[badge].label} role="img" dangerouslySetInnerHTML={{ __html: badgeSvg(badge, 12) }} />
          <span className={styles.name}>{e.name}</span>
          {e.michelin && (
            <span className={styles.mich} title={michelinWords(e.michelin)}>
              {e.michelin === 'bib' ? <span dangerouslySetInnerHTML={{ __html: bibFaceSvg(12) }} /> : !isStarred(e.michelin) ? <span dangerouslySetInnerHTML={{ __html: flowerSvg(12, '#9E2A2B') }} /> : '★'.repeat(Number(e.michelin))}
            </span>
          )}
          {e.price != null && <span className={styles.price}>{priceLabel(e.price)}</span>}
        </button>
        {canSchedule && (
          <button
            type="button"
            className={styles.addDay}
            disabled={!openDay}
            onClick={() => openDay && onAddToDay!(e.id, 'eatery')}
            aria-label={openDay ? `Add ${e.name} to ${openDay.label}` : 'Add to a day — open the itinerary first'}
            title={openDay ? `Add to ${openDay.label}` : 'Add to a day — open the itinerary first'}
          >
            +
          </button>
        )}
        <EyeButton label={e.name} state={eyeState([e.id], picked, showAll)} onClick={() => onPick([e.id])} />
      </li>
    )
  }

  return (
    <ul className={styles.tree}>
      {tree.map(c => {
        const openC = open.has(c.key)
        const cIds = [...c.loose.map(e => e.id), ...c.dishes.flatMap(d => d.eateries.map(e => e.id))]
        return (
          <li key={c.key}>
            <div className={styles.nodeLi}>
              <button type="button" className={styles.node} aria-expanded={openC} onClick={() => toggle(c.key)}>
                <span className={styles.arrow} aria-hidden="true">{openC ? '▾' : '▸'}</span>
                <span className={styles.dot} style={{ background: c.color }} />
                <span className={styles.name}>{c.label}</span>
                <span className={styles.cnt}>{c.count}</span>
              </button>
              <EyeButton label={c.label} state={eyeState(cIds, picked, showAll)} onClick={() => onPick(cIds)} />
            </div>
            {openC && (
              <ul className={styles.tree} style={{ paddingLeft: 22 }}>
                {c.loose.map(row)}
                {c.dishes.map(d => {
                  const dk = `${c.key}/${d.key}`
                  const openD = open.has(dk)
                  const dIds = d.eateries.map(e => e.id)
                  return (
                    <li key={dk}>
                      <div className={styles.nodeLi}>
                        <button type="button" className={styles.node} aria-expanded={openD} onClick={() => toggle(dk)}>
                          <span className={styles.arrow} aria-hidden="true">{openD ? '▾' : '▸'}</span>
                          <span className={`${styles.name} ${styles.dish}`}>{d.label}</span>
                          <span className={styles.cnt}>{d.count}</span>
                        </button>
                        <EyeButton label={d.label} state={eyeState(dIds, picked, showAll)} onClick={() => onPick(dIds)} />
                      </div>
                      {openD && <ul className={styles.tree} style={{ paddingLeft: 22 }}>{d.eateries.map(row)}</ul>}
                    </li>
                  )
                })}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}
