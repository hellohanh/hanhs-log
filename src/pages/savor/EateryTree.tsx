import { useState } from 'react'
import { buildCountryTree } from '../../lib/savorTree'
import { asReviews, priceLabel, type Eatery, type EateryReview } from '../../lib/eateries'
import { stopRef } from '../../lib/itinerary'
import { badgeSvg, flowerSvg, BADGE } from '../../lib/pinDraw'
import { pinBadge } from '../../lib/pinRules'
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
  onAddToDay
}: {
  eateries: Eatery[]
  reviews: EateryReview[]
  openDay?: { id: string; label: string } | null
  onOpen: (e: Eatery) => void
  onAddToDay?: (id: string, kind: 'eatery') => void
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
        >
          <span className={styles.status} title={BADGE[badge].label} aria-label={BADGE[badge].label} role="img" dangerouslySetInnerHTML={{ __html: badgeSvg(badge, 12) }} />
          <span className={styles.name}>{e.name}</span>
          {e.michelin && (
            <span className={styles.mich} title={e.michelin === 'mentioned' ? 'MICHELIN' : `MICHELIN ${e.michelin} star${e.michelin === '1' ? '' : 's'}`}>
              {e.michelin === 'mentioned' ? <span dangerouslySetInnerHTML={{ __html: flowerSvg(12, '#9E2A2B') }} /> : '★'.repeat(Number(e.michelin))}
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
      </li>
    )
  }

  return (
    <ul className={styles.tree}>
      {tree.map(c => {
        const openC = open.has(c.key)
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
                {c.loose.map(row)}
                {c.dishes.map(d => {
                  const dk = `${c.key}/${d.key}`
                  const openD = open.has(dk)
                  return (
                    <li key={dk}>
                      <button type="button" className={styles.node} aria-expanded={openD} onClick={() => toggle(dk)}>
                        <span className={styles.arrow} aria-hidden="true">{openD ? '▾' : '▸'}</span>
                        <span className={`${styles.name} ${styles.dish}`}>{d.label}</span>
                        <span className={styles.cnt}>{d.count}</span>
                      </button>
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
