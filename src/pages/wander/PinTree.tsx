import { useState } from 'react'
import { buildPinTree, type PinNode } from '../../lib/pinCatalog'
import { flowerSvg, BADGE } from '../../lib/pinDraw'
import { pinBadge, type Pin, type Review } from '../../lib/pins'
import type { StopKind } from '../../lib/itinerary'
import { eyeState } from '../../lib/pinRules'
import EyeButton from '../../components/EyeButton'
import styles from './Places.module.css'

// The pinned list as a collapsible tree (E30, built session 6): category ›
// sub-category › sub-sub-category › pins, only branches with pins, every level
// collapsed on each visit. Pins sit a level in under their node; a pin whose
// deeper level isn't set sits directly under its parent.

const STEP = 22

export default function PinTree({
  pins,
  reviews,
  openDay,
  onOpen,
  onAddToDay,
  picked,
  showAll,
  onPick
}: {
  pins: Pin[]
  reviews: Review[]
  openDay: { id: string; label: string } | null
  onOpen: (pin: Pin) => void
  onAddToDay: (id: string, kind: StopKind) => void
  /** The eyes (session 10): which places show while Show all pins is off. */
  picked: Set<string>
  showAll: boolean
  onPick: (ids: string[]) => void
}) {
  const tree = buildPinTree(pins)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (key: string) =>
    setOpen(s => {
      const next = new Set(s)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const idsOf = (n: PinNode<Pin>): string[] => [...n.pins.map(p => p.id), ...n.children.flatMap(idsOf)]

  const rows: React.ReactNode[] = []
  const walk = (nodes: PinNode<Pin>[], depth: number) => {
    for (const n of nodes) {
      const expanded = open.has(n.key)
      const ids = idsOf(n)
      rows.push(
        <li key={n.key} className={styles.nodeLi}>
          <button
            type="button"
            className={styles.node}
            style={{ paddingLeft: 6 + depth * STEP }}
            aria-expanded={expanded}
            aria-label={`${n.label}, ${n.count} ${n.count === 1 ? 'pin' : 'pins'}`}
            onClick={() => toggle(n.key)}
          >
            <span className={styles.arrow} aria-hidden="true">{expanded ? '▾' : '▸'}</span>
            <span className={styles.catDot} style={{ background: n.color }} />
            <span className={styles.name}>{n.label}</span>
            <span className={styles.count}>{n.count}</span>
          </button>
          <EyeButton label={n.label} state={eyeState(ids, picked, showAll)} onClick={() => onPick(ids)} />
        </li>
      )
      if (expanded) {
        walk(n.children, depth + 1)
        for (const p of n.pins) rows.push(leafRow(p, depth + 1))
      }
    }
  }

  function leafRow(p: Pin, depth: number) {
    const badge = pinBadge(reviews.filter(r => r.pin_id === p.id))
    return (
      <li key={p.id} className={styles.rowLi} style={{ paddingLeft: 6 + depth * STEP }}>
        <button
          type="button"
          className={styles.row}
          draggable
          onDragStart={e => {
            e.dataTransfer.setData('text/plain', p.id)
            e.dataTransfer.effectAllowed = 'copy'
          }}
          onClick={() => onOpen(p)}
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
          onClick={() => openDay && onAddToDay(p.id, 'pin')}
          aria-label={openDay ? `Add ${p.name} to ${openDay.label}` : 'Add to a day — open the itinerary first'}
          title={openDay ? `Add to ${openDay.label}` : 'Add to a day — open the itinerary first'}
        >
          +
        </button>
        <EyeButton label={p.name} state={eyeState([p.id], picked, showAll)} onClick={() => onPick([p.id])} />
      </li>
    )
  }

  walk(tree, 0)
  return <ul className={styles.tree}>{rows}</ul>
}
