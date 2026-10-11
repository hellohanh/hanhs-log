import { useEffect, useRef, useState } from 'react'
import { HOUR_PX, connectorGeometry, formatMeters, formatMinutes } from '../../lib/itineraryLayout'
import type { Connector, ConnMode, Stop } from '../../lib/itinerary'
import type { LegTime } from '../../lib/directions'
import styles from './Itinerary.module.css'

// Connectors between a day's time-consecutive stops (approved mockup,
// session 6): a dashed "C" from the left edge of one block to the next
// (endpoints at 50%, a middle block at 58% out / 42% in). A 22 px badge
// centered on the vertical line carries the tinted mode icon, with the live
// Google time and distance below it. An empty dashed "+" badge until a mode
// is set; tap the badge to open the mode picker. Times are fetched live and
// never stored.

export const MODES: { key: ConnMode; label: string; color: string; icon: string }[] = [
  { key: 'walk', label: 'Walk', color: '#2F8A3E', icon: 'M13.5 5.5a1.6 1.6 0 1 0 0-.01M11 22l1.6-5 2.4-2m-5.2.5L7 13l1-5 3 1.2L14 11m-3-.5 1.5 4.5 2.5 3' },
  { key: 'drive', label: 'Drive', color: '#185FA5', icon: 'M5 11l1.5-4h11L19 11M4 17h16v-5H4zM7.5 17v1.5M16.5 17v1.5M7 14.5h.01M17 14.5h.01' },
  { key: 'transit', label: 'Transit', color: '#6A3FA0', icon: 'M6 4h12a2 2 0 0 1 2 2v9H4V6a2 2 0 0 1 2-2zM4 10h16M8 4v6M16 4v6M7.5 18.5h.01M16.5 18.5h.01M6 15v2.5M18 15v2.5' },
  { key: 'bike', label: 'Bike', color: '#C8781E', icon: 'M6 18.5a3 3 0 1 0 0-.01M18 18.5a3 3 0 1 0 0-.01M9 18.5h6l-2.5-6 2-3h2.5M10.5 9.5H14M8.5 12.5l2.5-3' }
]
const MODE_BY = Object.fromEntries(MODES.map(m => [m.key, m])) as Record<ConnMode, (typeof MODES)[number]>

const GUTTER = 72 // blocks' left edge; matches ItineraryPanel
const SPINE = 54 // where the vertical dashed line and the badge sit

export const pairKey = (from: string, to: string) => `${from}>${to}`
/** Key for a leg's live time, including the mode so a mode change refetches. */
export const legKey = (from: string, to: string, mode: ConnMode) => `${from}>${to}:${mode}`

export function StopConnectors({
  stops,
  connectors,
  times,
  dayId,
  onSet,
  onClear
}: {
  stops: Stop[]
  connectors: Connector[]
  /** Live Google times keyed by legKey(from, to, mode); fetched by the panel. */
  times: Record<string, LegTime | null | undefined>
  dayId: string
  onSet: (dayId: string, fromStopId: string, toStopId: string, mode: ConnMode) => Promise<void>
  onClear: (fromStopId: string, toStopId: string) => Promise<void>
}) {
  const modeOf = new Map(connectors.map(c => [pairKey(c.from_stop_id, c.to_stop_id), c.mode]))
  const [pick, setPick] = useState<{ from: string; to: string; mid: number } | null>(null)

  if (stops.length < 2) return null

  return (
    <>
      <svg className={styles.connSvg} width="100%" height={24 * HOUR_PX} aria-hidden="true">
        {stops.slice(0, -1).map((s, i) => {
          const g = connectorGeometry(stops, i)
          return <path key={s.id} className={styles.connPath} d={`M${GUTTER} ${g.yU} H${SPINE} V${g.yL} H${GUTTER}`} />
        })}
      </svg>

      {stops.slice(0, -1).map((s, i) => {
        const from = s.id
        const to = stops[i + 1].id
        const g = connectorGeometry(stops, i)
        const mode = modeOf.get(pairKey(from, to))
        const cfg = mode ? MODE_BY[mode] : null
        const leg = mode ? times[legKey(from, to, mode)] : undefined
        return (
          <div key={from} className={styles.conn} style={{ left: SPINE, top: g.mid }} onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
            <button
              type="button"
              className={`${styles.connBadge} ${mode ? '' : styles.connAdd}`}
              style={cfg ? { borderColor: cfg.color } : undefined}
              aria-label={mode ? `Travel: ${cfg!.label}. Change` : 'Add travel between these places'}
              title={mode ? `${cfg!.label} — tap to change` : 'Add travel'}
              onClick={e => {
                e.stopPropagation()
                setPick(p => (p && p.from === from && p.to === to ? null : { from, to, mid: g.mid }))
              }}
            >
              {cfg ? <ModeIcon icon={cfg.icon} color={cfg.color} /> : <PlusIcon />}
            </button>
            {mode && (
              <span className={styles.connCap}>
                {leg === undefined ? '…' : leg === null ? 'no route' : `${formatMinutes(leg.minutes)}\n${formatMeters(leg.meters)}`}
              </span>
            )}
          </div>
        )
      })}

      {pick && (
        <ConnPicker
          mid={pick.mid}
          current={modeOf.get(pairKey(pick.from, pick.to)) ?? null}
          onPick={async m => {
            await onSet(dayId, pick.from, pick.to, m)
            setPick(null)
          }}
          onClear={async () => {
            await onClear(pick.from, pick.to)
            setPick(null)
          }}
          onClose={() => setPick(null)}
        />
      )}
    </>
  )
}

function ConnPicker({
  mid,
  current,
  onPick,
  onClear,
  onClose
}: {
  mid: number
  current: ConnMode | null
  onPick: (m: ConnMode) => void
  onClear: () => void
  onClose: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])
  return (
    <div ref={box} className={styles.connPicker} style={{ top: mid }} role="dialog" aria-label="Pick a travel mode" onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
      {MODES.map(m => (
        <button
          key={m.key}
          type="button"
          role="radio"
          aria-checked={current === m.key}
          className={`${styles.connMode} ${current === m.key ? styles.connModeOn : ''}`}
          onClick={() => onPick(m.key)}
        >
          <ModeIcon icon={m.icon} color={m.color} />
          {m.label}
        </button>
      ))}
      {current && (
        <button type="button" className={styles.connModeClear} onClick={onClear}>Remove</button>
      )}
    </div>
  )
}

function ModeIcon({ icon, color }: { icon: string; color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={icon} />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
