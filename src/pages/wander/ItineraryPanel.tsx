import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addExtraDay,
  dayTab,
  deleteDay,
  deleteLeg,
  fetchDays,
  fetchLegs,
  fillTripDates,
  saveDayNote,
  saveLeg,
  type ItineraryDay,
  type LegFields,
  type TravelLeg
} from '../../lib/itinerary'
import {
  HOUR_PX,
  LEG_MODE_CONFIG,
  SCROLL_TO_HOUR,
  blockPositionStyle,
  carrierLogoPath,
  computeColumnLayout,
  continuationBlockGeometry,
  legBlockGeometry,
  legDayOffset,
  legDurationParts
} from '../../lib/itineraryLayout'
import { loadGoogleMaps } from '../../lib/googleMaps'
import TravelForm from './TravelForm'
import styles from './Itinerary.module.css'

// The itinerary panel (approved inline mockup, session 4): a right-hand
// panel over the map, 320 px or 640 px wide (covers the map), closed by
// default behind a tab on the map's right edge. Header: route map, widen,
// close. Day tabs (the trip's dates, plus extra days), a row with Show all
// pins, Add travel and Day note, then the day's hour timeline with travel
// legs. Scheduling places, connectors and route lines come with pins.

export const PANEL_WIDTH = 320
const GUTTER = 52

export default function ItineraryPanel({
  tripId,
  start,
  end,
  wide,
  home,
  onWide,
  onClose
}: {
  tripId: string
  start: string | null
  end: string | null
  wide: boolean
  home: { center: google.maps.LatLngLiteral; zoom: number }
  onWide: () => void
  onClose: () => void
}) {
  const [days, setDays] = useState<ItineraryDay[] | null>(null)
  const [legs, setLegs] = useState<TravelLeg[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState<{ leg: TravelLeg | null } | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [showAll, setShowAll] = useState(true)
  const [routeOpen, setRouteOpen] = useState(false)
  const [confirmDay, setConfirmDay] = useState(false)
  const timeline = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      let list = await fetchDays(tripId)
      if (await fillTripDates(tripId, start, end, list)) list = await fetchDays(tripId)
      setDays(list)
      setLegs(await fetchLegs(list.map(d => d.id)))
      setSelected(s => (s && list.some(d => d.id === s) ? s : list[0]?.id ?? null))
    } catch (e) {
      setError((e as Error).message)
    }
  }, [tripId, start, end])

  useEffect(() => {
    load()
  }, [load])

  const dayIndex = days?.findIndex(d => d.id === selected) ?? -1
  const day = days && dayIndex >= 0 ? days[dayIndex] : null

  // Start each day's timeline at 6:00, as in old Wanderlog.
  useEffect(() => {
    if (timeline.current) timeline.current.scrollTop = SCROLL_TO_HOUR * HOUR_PX
  }, [selected, days === null, form === null])

  // Legs that leave on this day, and legs from an earlier day that land on it.
  const { own, continuing } = useMemo(() => {
    if (!day) return { own: [] as TravelLeg[], continuing: [] as TravelLeg[] }
    const own = legs.filter(l => l.day_id === day.id)
    const continuing = day.date
      ? legs.filter(l => l.day_id !== day.id && l.to_date === day.date && (legDayOffset(l) ?? 0) > 0)
      : []
    return { own, continuing }
  }, [legs, day])

  const layout = useMemo(
    () =>
      computeColumnLayout([
        ...own.map(l => ({ id: l.id, ...legBlockGeometry(l) })),
        ...continuing.map(l => ({ id: `c-${l.id}`, ...continuationBlockGeometry(l) }))
      ]),
    [own, continuing]
  )

  // Dated days follow the trip's dates (change them in Edit trip); extra
  // days, and dated days outside the trip's dates, can be deleted.
  const canDelete = !!day && (!day.date || !start || !end || day.date < start || day.date > end)

  async function removeDay() {
    if (!day) return
    try {
      await deleteDay(day.id)
      setConfirmDay(false)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <aside className={`${styles.panel} ${wide ? styles.wide : ''}`} aria-label="Itinerary">
      <div className={styles.head}>
        <strong>Itinerary</strong>
        <IconBtn label="Day route map" onClick={() => setRouteOpen(true)}><MapIcon /></IconBtn>
        <IconBtn label={wide ? 'Back to normal width' : 'Widen to 200%'} pressed={wide} onClick={onWide}><WidenIcon /></IconBtn>
        <IconBtn label="Close the itinerary" onClick={onClose}><CloseIcon /></IconBtn>
      </div>

      {error && <p className={styles.error} role="alert">Couldn't load the itinerary: {error}</p>}
      {days === null && !error && <p className={styles.muted} role="status">Loading the itinerary…</p>}

      {days && (
        <>
          <div className={styles.days} role="tablist" aria-label="Days">
            {days.map((d, i) => {
              const t = dayTab(d, i)
              return (
                <button
                  key={d.id}
                  type="button"
                  role="tab"
                  aria-selected={d.id === selected}
                  className={styles.day}
                  onClick={() => {
                    setSelected(d.id)
                    setForm(null)
                    setConfirmDay(false)
                  }}
                >
                  {t.top}
                  <b>{t.main}</b>
                </button>
              )
            })}
            <button
              type="button"
              className={`${styles.day} ${styles.addDay}`}
              onClick={async () => {
                try {
                  await addExtraDay(tripId)
                  await load()
                } catch (e) {
                  setError((e as Error).message)
                }
              }}
            >
              +<b>Day</b>
            </button>
          </div>

          {days.length === 0 && (
            <p className={styles.muted}>Add the trip's dates in Edit trip to get a tab for each day, or add a day with + Day.</p>
          )}

          {day && (
            <>
              <div className={styles.tools}>
                <label className={styles.showAll}>
                  <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> Show all pins
                </label>
                <IconBtn label="Add travel (flight, train, bus, own transport)" onClick={() => setForm({ leg: null })}><PlaneIcon /></IconBtn>
                <IconBtn label="Day note" pressed={noteOpen || !!day.note} onClick={() => setNoteOpen(o => !o)}><NoteIcon /></IconBtn>
                {canDelete && <IconBtn label="Delete this day" onClick={() => setConfirmDay(true)}><TrashIcon /></IconBtn>}
              </div>

              {confirmDay && (
                <div className={styles.confirm} role="alert">
                  <span>Delete this day and its travel?</span>
                  <button type="button" className="btn" onClick={removeDay}>Delete</button>
                  <button type="button" className="btn btn-quiet" onClick={() => setConfirmDay(false)}>Keep</button>
                </div>
              )}

              {noteOpen && (
                <DayNote
                  key={day.id}
                  day={day}
                  onSaved={note => setDays(ds => ds && ds.map(d => (d.id === day.id ? { ...d, note } : d)))}
                />
              )}
              {!noteOpen && day.note && (
                <button type="button" className={styles.notePreview} onClick={() => setNoteOpen(true)}>{day.note}</button>
              )}

              {form ? (
                <div className={styles.formWrap}>
                  <TravelForm
                    dayId={day.id}
                    dayDate={day.date}
                    leg={form.leg}
                    onCancel={() => setForm(null)}
                    onSave={async (fields: LegFields, id?: string) => {
                      await saveLeg(fields, id)
                      setForm(null)
                      setLegs(await fetchLegs(days.map(d => d.id)))
                    }}
                    onDelete={async id => {
                      await deleteLeg(id)
                      setForm(null)
                      setLegs(await fetchLegs(days.map(d => d.id)))
                    }}
                  />
                </div>
              ) : (
                <div className={styles.timeline} ref={timeline}>
                  <div className={styles.hours} style={{ height: 24 * HOUR_PX }}>
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className={styles.hour} style={{ top: h * HOUR_PX }}>{`${h}:00`}</div>
                    ))}
                    {own.map(l => {
                      const g = legBlockGeometry(l)
                      return (
                        <LegCard key={l.id} leg={l} top={g.top} height={g.height} note={g.crossesMidnight ? 'continues next day →' : null}
                          pos={blockPositionStyle(layout.get(l.id), GUTTER)} onClick={() => setForm({ leg: l })} />
                      )
                    })}
                    {continuing.map(l => {
                      const g = continuationBlockGeometry(l)
                      return (
                        <LegCard key={`c-${l.id}`} leg={l} top={g.top} height={g.height} note="← continued from the day before"
                          pos={blockPositionStyle(layout.get(`c-${l.id}`), GUTTER)} onClick={() => setForm({ leg: l })} />
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {routeOpen && <RouteMap home={home} title={day ? `${dayTab(day, dayIndex).top} ${dayTab(day, dayIndex).main}` : 'Day'} onClose={() => setRouteOpen(false)} />}
    </aside>
  )
}

function DayNote({ day, onSaved }: { day: ItineraryDay; onSaved: (note: string | null) => void }) {
  const [text, setText] = useState(day.note ?? '')
  const [status, setStatus] = useState('')
  async function save() {
    if ((day.note ?? '') === text.trim()) return
    setStatus('Saving…')
    try {
      await saveDayNote(day.id, text)
      onSaved(text.trim() || null)
      setStatus('Saved')
    } catch (e) {
      setStatus(`Couldn't save: ${(e as Error).message}`)
    }
  }
  return (
    <div className={styles.note}>
      <label className={styles.lf}>
        Day note
        <textarea value={text} onChange={e => setText(e.target.value)} onBlur={save} rows={3} maxLength={4000} placeholder="Tết closures, book a Grab early…" autoFocus />
      </label>
      <span className={styles.muted} role="status">{status}</span>
    </div>
  )
}

function LegCard({
  leg,
  top,
  height,
  note,
  pos,
  onClick
}: {
  leg: TravelLeg
  top: number
  height: number
  note: string | null
  pos: { left: string; width: string }
  onClick: () => void
}) {
  const cfg = LEG_MODE_CONFIG[leg.mode]
  const d = legDurationParts(leg)
  const plus = legDayOffset(leg)
  const name = [leg.carrier, leg.reference].filter(Boolean).join(' ') || leg.title || cfg.label
  return (
    <button type="button" className={styles.leg} style={{ top, height: Math.max(height, 56), borderLeftColor: cfg.color, ...pos }} onClick={onClick}>
      <span className={styles.legTop}>
        <Badge leg={leg} />
        <b>{name}</b>
      </span>
      <span className={styles.legRoute}>
        {leg.from_location} {leg.from_time?.slice(0, 5)} → {leg.to_location} {leg.to_time?.slice(0, 5)}
        {plus ? <sup> +{plus}</sup> : null}
      </span>
      {d && <span className={styles.legMeta}>{d.hours}h {d.minutes}m</span>}
      {note && <span className={styles.legMeta}>{note}</span>}
    </button>
  )
}

function Badge({ leg }: { leg: TravelLeg }) {
  const [logoFailed, setLogoFailed] = useState(false)
  const cfg = LEG_MODE_CONFIG[leg.mode]
  if (leg.mode === 'flight' && leg.carrier && !logoFailed) {
    return <img className={styles.logo} src={carrierLogoPath(leg.carrier)} alt="" onError={() => setLogoFailed(true)} />
  }
  return <span className={styles.modeDot} style={{ background: cfg.color }} dangerouslySetInnerHTML={{ __html: cfg.svg }} />
}

// The day's route map (kept from old Wanderlog). Stops and their route
// appear once places can be scheduled (after pins).
function RouteMap({ home, title, onClose }: { home: { center: google.maps.LatLngLiteral; zoom: number }; title: string; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    loadGoogleMaps().then(g => {
      if (!g || !box.current) return
      new g.maps.Map(box.current, { ...home, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, gestureHandling: 'greedy' })
    }, () => undefined)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [home, onClose])
  return (
    <div className={styles.routeScrim} onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.route} role="dialog" aria-label="Day route map">
        <div className={styles.routeHead}>
          <strong>{title} · route</strong>
          <IconBtn label="Close" onClick={onClose}><CloseIcon /></IconBtn>
        </div>
        <div ref={box} className={styles.routeMap} />
        <p className={styles.muted}>This day's stops and route show here once places are added to the day.</p>
      </div>
    </div>
  )
}

function IconBtn({ label, pressed, onClick, children }: { label: string; pressed?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={styles.ib} aria-label={label} title={label} aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  )
}

const svg = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
const MapIcon = () => <svg {...svg}><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14M15 6v14" /></svg>
const WidenIcon = () => <svg {...svg}><path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4" /></svg>
const CloseIcon = () => <svg {...svg}><path d="M6 6l12 12M18 6 6 18" /></svg>
const PlaneIcon = () => <svg {...svg}><path d="M21 16v-2l-8-5V4.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-3 2v1.5l4.5-1 4.5 1V21l-3-2v-4.5l8 2.5z" /></svg>
const NoteIcon = () => <svg {...svg}><path d="M5 4h14v16H5z" /><path d="M9 9h6M9 13h6M9 17h3" /></svg>
const TrashIcon = () => <svg {...svg}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>

export function ItineraryOpener({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className={styles.opener} onClick={onOpen} aria-label="Open the itinerary">
      <svg {...svg}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>
      <span>Itinerary</span>
    </button>
  )
}
