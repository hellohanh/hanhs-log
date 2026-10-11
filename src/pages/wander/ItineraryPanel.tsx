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
  deleteActivity,
  fetchActivities,
  saveActivity,
  deleteStop,
  fetchStops,
  saveStop,
  type Activity,
  type ItineraryDay,
  type LegFields,
  type Stop,
  type TravelLeg
} from '../../lib/itinerary'
import { pinBadge, type Pin, type Review } from '../../lib/pins'
import { StopBlock, StopEdit, STOP_MIN, nextStopStart } from './StopBlock'
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
import { ActivityBlock, ActivityFields, AddPopup, usePopupStyle } from './ActivityBlock'
import { ADD_SNAP_MIN, NEW_BLOCK_MIN, hhmm, minuteAt, toMin } from '../../lib/itineraryDays'
import styles from './Itinerary.module.css'

// The itinerary panel (approved inline mockup, session 4): a right-hand
// panel over the map, 320 px or 640 px wide (covers the map), closed by
// default behind a tab on the map's right edge. Header: route map, widen,
// close. Day tabs (the trip's dates, plus extra days), a row with Add
// travel and Day note (OTD Pins joins it with places on days), then the day's hour timeline with travel
// legs. Scheduling places, connectors and route lines come with pins.

export const PANEL_WIDTH = 320
const GUTTER = 52

export default function ItineraryPanel({
  tripId,
  start,
  end,
  wide,
  home,
  pins,
  reviews,
  addRequest,
  onWide,
  onClose,
  onOpenDay,
  onOtdPins
}: {
  tripId: string
  start: string | null
  end: string | null
  wide: boolean
  home: { center: google.maps.LatLngLiteral; zoom: number }
  pins: Pin[]
  reviews: Review[]
  /** A pin the Places panel asked to add to the open day (new object each time). */
  addRequest: { pinId: string; n: number } | null
  onWide: () => void
  onClose: () => void
  /** The day shown now (for the "Add to day" button), or null. */
  onOpenDay: (day: { id: string; label: string } | null) => void
  /** Pin ids to keep full strength on the map when OTD Pins is on, or null when off. */
  onOtdPins: (pinIds: string[] | null) => void
}) {
  const [days, setDays] = useState<ItineraryDay[] | null>(null)
  const [legs, setLegs] = useState<TravelLeg[]>([])
  const [stops, setStops] = useState<Stop[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState<{ leg: TravelLeg | null; preset?: { from: string; to: string } } | null>(null)
  const [acts, setActs] = useState<Activity[]>([])
  // Click on an empty spot: "Add at …" popup at that 15-minute mark (session 4).
  const [adding, setAdding] = useState<{ start: number; end: number } | null>(null)
  const [editing, setEditing] = useState<Activity | null>(null)
  const [editStop, setEditStop] = useState<Stop | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [routeOpen, setRouteOpen] = useState(false)
  const [confirmDay, setConfirmDay] = useState(false)
  // OTD Pins: off every visit; on fades the map's other pins (Hanh, session 4).
  const [otd, setOtd] = useState(false)
  // A pin being dragged in from the Places panel: which day tab, or the timeline, is lit up.
  const [dropTarget, setDropTarget] = useState<string | 'timeline' | null>(null)
  const timeline = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      let list = await fetchDays(tripId)
      if (await fillTripDates(tripId, start, end, list)) list = await fetchDays(tripId)
      setDays(list)
      setLegs(await fetchLegs(list.map(d => d.id)))
      setActs(await fetchActivities(list.map(d => d.id)))
      setStops(await fetchStops(list.map(d => d.id)))
      setSelected(s => (s && list.some(d => d.id === s) ? s : list[0]?.id ?? null))
    } catch (e) {
      setError((e as Error).message)
    }
  }, [tripId, start, end])

  useEffect(() => {
    load()
  }, [load])

  const pinById = useMemo(() => new Map(pins.map(p => [p.id, p])), [pins])

  async function reloadStops() {
    if (days) setStops(await fetchStops(days.map(d => d.id)))
  }

  // Add a pin to a day: at a given minute (timeline drop / Add popup) or the
  // next free slot (day tab drop, the "+" button). 60-minute block.
  const addStop = useCallback(
    async (dayId: string, pinId: string, startMin?: number) => {
      const s = startMin ?? nextStopStart(stops.filter(st => st.day_id === dayId))
      const e = Math.min(24 * 60 - 1, s + STOP_MIN)
      try {
        await saveStop({ day_id: dayId, pin_id: pinId, start_time: hhmm(s), end_time: hhmm(e) })
        if (days) setStops(await fetchStops(days.map(d => d.id)))
      } catch (err) {
        setError((err as Error).message)
      }
    },
    [stops, days]
  )

  // The Places panel asked to add a pin to the open day. Start caught up so a
  // request from a previous open session isn't re-run when the panel reopens.
  const lastReq = useRef(addRequest?.n ?? 0)
  useEffect(() => {
    if (addRequest && addRequest.n !== lastReq.current && selected) {
      lastReq.current = addRequest.n
      addStop(selected, addRequest.pinId)
    }
  }, [addRequest, selected, addStop])

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

  const dayActs = useMemo(() => (day ? acts.filter(a => a.day_id === day.id) : []), [acts, day])
  const dayStops = useMemo(() => (day ? stops.filter(s => s.day_id === day.id) : []), [stops, day])

  const layout = useMemo(
    () =>
      computeColumnLayout([
        ...own.map(l => ({ id: l.id, ...legBlockGeometry(l) })),
        ...continuing.map(l => ({ id: `c-${l.id}`, ...continuationBlockGeometry(l) })),
        ...dayActs.map(a => ({
          id: `a-${a.id}`,
          top: (toMin(a.start_time) / 60) * HOUR_PX,
          height: ((toMin(a.end_time) - toMin(a.start_time)) / 60) * HOUR_PX
        })),
        ...dayStops.map(s => ({
          id: `s-${s.id}`,
          top: (toMin(s.start_time) / 60) * HOUR_PX,
          height: ((toMin(s.end_time) - toMin(s.start_time)) / 60) * HOUR_PX
        }))
      ]),
    [own, continuing, dayActs, dayStops]
  )

  // Tell the trip page which day is open and which pins to keep bright on the
  // map (OTD Pins on → this day's pins; off → null, Places rules apply).
  useEffect(() => {
    if (day) {
      const t = dayTab(day, dayIndex)
      onOpenDay({ id: day.id, label: `${t.top} ${t.main}`.trim() })
    } else onOpenDay(null)
  }, [day, dayIndex, onOpenDay])
  useEffect(() => {
    onOtdPins(otd && day ? dayStops.map(s => s.pin_id) : null)
  }, [otd, day, dayStops, onOtdPins])
  useEffect(() => () => { onOpenDay(null); onOtdPins(null) }, [onOpenDay, onOtdPins])

  async function reloadActs() {
    if (days) setActs(await fetchActivities(days.map(d => d.id)))
  }

  // Read the pin id a drag carries (set by the Places panel's rows).
  const draggedPin = (e: React.DragEvent) => e.dataTransfer.getData('text/plain')
  const hasPin = (e: React.DragEvent) => e.dataTransfer.types.includes('text/plain')

  async function changeActivity(a: Activity, startT: string, endT: string) {
    // Show the new time straight away; put it back if saving fails.
    setActs(list => list.map(x => (x.id === a.id ? { ...x, start_time: startT, end_time: endT } : x)))
    try {
      await saveActivity({ start_time: startT, end_time: endT }, a.id)
    } catch (e) {
      setError((e as Error).message)
      await reloadActs()
    }
  }

  async function changeStop(s: Stop, startT: string, endT: string) {
    setStops(list => list.map(x => (x.id === s.id ? { ...x, start_time: startT, end_time: endT } : x)))
    try {
      await saveStop({ start_time: startT, end_time: endT }, s.id)
    } catch (e) {
      setError((e as Error).message)
      await reloadStops()
    }
  }

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
                  className={`${styles.day} ${dropTarget === d.id ? styles.dropOn : ''}`}
                  onClick={() => {
                    setSelected(d.id)
                    setForm(null)
                    setAdding(null)
                    setEditing(null)
                    setEditStop(null)
                    setConfirmDay(false)
                  }}
                  onDragOver={e => { if (hasPin(e)) { e.preventDefault(); setDropTarget(d.id) } }}
                  onDragLeave={() => setDropTarget(t => (t === d.id ? null : t))}
                  onDrop={e => {
                    if (!hasPin(e)) return
                    e.preventDefault()
                    setDropTarget(null)
                    const pinId = draggedPin(e)
                    if (pinId) addStop(d.id, pinId)
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
                <label className={styles.showAll} title="Fade the map's other pins, so this day's places stand out">
                  <input type="checkbox" checked={otd} onChange={e => setOtd(e.target.checked)} /> OTD Pins
                </label>
                <IconBtn label="Add travel (flight, train, bus, own transport)" onClick={() => setForm({ leg: null })}><PlaneIcon /></IconBtn>
                <IconBtn label="Day note" pressed={noteOpen || !!day.note} onClick={() => setNoteOpen(o => !o)}><NoteIcon /></IconBtn>
                {canDelete && <IconBtn label="Delete this day" onClick={() => setConfirmDay(true)}><TrashIcon /></IconBtn>}
              </div>

              {confirmDay && (
                <div className={styles.confirm} role="alert">
                  <span>Delete this day, its travel, activities and places?</span>
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
                    preset={form.preset}
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
                <div className={styles.timeline} ref={timeline} data-scroll="timeline">
                  <div
                    className={`${styles.hours} ${dropTarget === 'timeline' ? styles.timelineDrop : ''}`}
                    style={{ height: 24 * HOUR_PX }}
                    data-testid="day-timeline"
                    onClick={e => {
                      if (adding || editing || editStop) {
                        setAdding(null)
                        setEditStop(null)
                        return
                      }
                      const y = e.clientY - e.currentTarget.getBoundingClientRect().top
                      const start = minuteAt(y, HOUR_PX, ADD_SNAP_MIN)
                      setAdding({ start, end: Math.min(24 * 60 - 1, start + NEW_BLOCK_MIN) })
                    }}
                    onDragOver={e => { if (hasPin(e)) { e.preventDefault(); setDropTarget('timeline') } }}
                    onDragLeave={e => { if (e.currentTarget === e.target) setDropTarget(t => (t === 'timeline' ? null : t)) }}
                    onDrop={e => {
                      if (!hasPin(e)) return
                      e.preventDefault()
                      setDropTarget(null)
                      const pinId = draggedPin(e)
                      if (!pinId) return
                      const y = e.clientY - e.currentTarget.getBoundingClientRect().top
                      addStop(day.id, pinId, minuteAt(y, HOUR_PX, ADD_SNAP_MIN))
                    }}
                  >
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
                    {dayActs.map(a => (
                      <ActivityBlock
                        key={a.id}
                        activity={a}
                        pos={blockPositionStyle(layout.get(`a-${a.id}`), GUTTER)}
                        onChange={(st, en) => changeActivity(a, st, en)}
                        onOpen={() => {
                          setAdding(null)
                          setEditing(a)
                        }}
                      />
                    ))}
                    {dayStops.map(s => {
                      const pin = pinById.get(s.pin_id)
                      if (!pin) return null
                      return (
                        <StopBlock
                          key={s.id}
                          stop={s}
                          pin={pin}
                          badge={pinBadge(reviews.filter(r => r.pin_id === s.pin_id))}
                          pos={blockPositionStyle(layout.get(`s-${s.id}`), GUTTER)}
                          onChange={(st, en) => changeStop(s, st, en)}
                          onOpen={() => {
                            setAdding(null)
                            setEditing(null)
                            setEditStop(s)
                          }}
                        />
                      )
                    })}
                    {adding && (
                      <>
                        <div
                          className={styles.ghost}
                          style={{ top: (adding.start / 60) * HOUR_PX, height: ((adding.end - adding.start) / 60) * HOUR_PX, left: GUTTER, right: 8 }}
                          aria-hidden="true"
                        />
                        <AddPopup
                          startPx={(adding.start / 60) * HOUR_PX}
                          endPx={(adding.end / 60) * HOUR_PX}
                          start={adding.start}
                          end={adding.end}
                          pins={pins}
                          onCancel={() => setAdding(null)}
                          onTravel={(st, en) => {
                            setAdding(null)
                            setForm({ leg: null, preset: { from: st, to: en } })
                          }}
                          onAddActivity={async (title, st, en) => {
                            await saveActivity({ day_id: day.id, title, start_time: st, end_time: en })
                            setAdding(null)
                            await reloadActs()
                          }}
                          onAddPlace={async (pinId, st, en) => {
                            await saveStop({ day_id: day.id, pin_id: pinId, start_time: st, end_time: en })
                            setAdding(null)
                            await reloadStops()
                          }}
                        />
                      </>
                    )}
                    {editing && (
                      <EditPop startPx={(toMin(editing.start_time) / 60) * HOUR_PX} endPx={(toMin(editing.end_time) / 60) * HOUR_PX}>
                        <div className={styles.addHead}>
                          <strong>Edit activity</strong>
                          <button type="button" className={styles.ib} aria-label="Close" onClick={() => setEditing(null)}>×</button>
                        </div>
                        <ActivityFields
                          key={editing.id}
                          initial={{ title: editing.title, start: editing.start_time.slice(0, 5), end: editing.end_time.slice(0, 5) }}
                          submitLabel="Save"
                          onCancel={() => setEditing(null)}
                          onSubmit={async (title, st, en) => {
                            await saveActivity({ title, start_time: st, end_time: en }, editing.id)
                            setEditing(null)
                            await reloadActs()
                          }}
                          onDelete={async () => {
                            await deleteActivity(editing.id)
                            setEditing(null)
                            await reloadActs()
                          }}
                        />
                      </EditPop>
                    )}
                    {editStop && pinById.get(editStop.pin_id) && (
                      <EditPop startPx={(toMin(editStop.start_time) / 60) * HOUR_PX} endPx={(toMin(editStop.end_time) / 60) * HOUR_PX} label={pinById.get(editStop.pin_id)!.name}>
                        <div className={styles.addHead}>
                          <strong>{pinById.get(editStop.pin_id)!.name}</strong>
                          <button type="button" className={styles.ib} aria-label="Close" onClick={() => setEditStop(null)}>×</button>
                        </div>
                        <StopEdit
                          key={editStop.id}
                          stop={editStop}
                          pin={pinById.get(editStop.pin_id)!}
                          onSubmit={async (st, en) => {
                            await saveStop({ start_time: st, end_time: en }, editStop.id)
                            setEditStop(null)
                            await reloadStops()
                          }}
                          onCancel={() => setEditStop(null)}
                          onDelete={async () => {
                            await deleteStop(editStop.id)
                            setEditStop(null)
                            await reloadStops()
                          }}
                        />
                      </EditPop>
                    )}
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

function EditPop({ startPx, endPx, label = 'Edit activity', children }: { startPx: number; endPx: number; label?: string; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const pos = usePopupStyle(box, startPx, endPx)
  return (
    <div ref={box} className={styles.addPop} style={pos} role="dialog" aria-label={label} onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
      {children}
    </div>
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
    <button type="button" className={styles.leg} style={{ top, height: Math.max(height, 56), borderLeftColor: cfg.color, ...pos }} onClick={e => { e.stopPropagation(); onClick() }}>
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
