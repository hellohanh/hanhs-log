import { useWaiting } from '../../components/useWaiting'
import { cityOf, legsOnRepeat, repeatFor, repeatIsEmpty, repeatStartMin, shortDate, tabCities, wantedRepeats } from '../../lib/dateLine'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { endLabel, MODE_EMOJI } from '../../lib/legDisplay'
import {
  addExtraDay,
  dayTab,
  deleteDay,
  deleteLeg,
  fetchDays,
  fetchLegs,
  fetchLegLinks,
  fetchLegsByIds,
  linkLeg,
  type LegLink,
  fillTripDates,
  syncRepeatDays,
  saveDayNote,
  saveLeg,
  deleteActivity,
  fetchActivities,
  saveActivity,
  deleteStop,
  fetchStops,
  saveStop,
  clearConnector,
  fetchConnectors,
  saveConnector,
  parseStopRef,
  stopTarget,
  stopTargetId,
  type Activity,
  type ConnMode,
  type Connector,
  type ItineraryDay,
  type LegFields,
  type Stop,
  type StopItem,
  type StopKind,
  type TravelLeg
} from '../../lib/itinerary'
import { pinBadge, type Pin, type Review } from '../../lib/pins'
import { asReviews, type Eatery, type EateryReview } from '../../lib/eateries'
import { computeLeg, type LegTime, type RouteSeg } from '../../lib/directions'
import { StopBlock, StopEdit, STOP_MIN, nextStopStart } from './StopBlock'
import { StopConnectors, legKey, pairKey } from './StopConnectors'
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
import TravelForm from './TravelForm'
import { fetchTrips, placeLabel, todayISO, type TripSummary } from '../../lib/trips'
import { ActivityBlock, ActivityFields, AddPopup, usePopupStyle } from './ActivityBlock'
import { ADD_SNAP_MIN, NEW_BLOCK_MIN, hhmm, minuteAt, toMin } from '../../lib/itineraryDays'
import styles from './Itinerary.module.css'

// The itinerary panel (approved inline mockup, session 4): a right-hand
// panel over the map, 320 px or 640 px wide (covers the map), closed by
// default behind a tab on the map's right edge. Header: route map, widen,
// close. Day tabs (the trip's dates, plus extra days), a row with Add
// travel and Day note (Day route joins it with places on days), then the day's hour timeline with travel
// legs. Scheduling places, connectors and route lines come with pins.

export const PANEL_WIDTH = 320
const GUTTER = 72 // wider so connector badges clear the hour labels (session 6)

export default function ItineraryPanel({
  tripId,
  start,
  end,
  wide,
  pins,
  reviews,
  eateries,
  eateryReviews,
  addRequest,
  onWide,
  onClose,
  onOpenDay,
  onOtdPins,
  onDayRoute,
  phone = false,
  routeOn
}: {
  tripId: string
  start: string | null
  end: string | null
  wide: boolean
  pins: Pin[]
  reviews: Review[]
  eateries: Eatery[]
  eateryReviews: EateryReview[]
  /** A place (pin or eatery) the Places panel asked to add to the open day (new object each time). */
  addRequest: { id: string; kind: StopKind; n: number } | null
  onWide: () => void
  onClose: () => void
  /** The day shown now (for the "Add to day" button), or null. */
  onOpenDay: (day: { id: string; label: string } | null) => void
  /** Pin ids to keep full strength on the map while the day route is on, or null. */
  onOtdPins: (pinIds: string[] | null) => void
  /** The day route to draw on the map (coloured per mode), or null when off/closed. */
  onDayRoute: (route: RouteSeg[] | null) => void
  /**
   * Phone layout (session 10, approved): shown inside a bottom sheet — no
   * widen / close buttons, one row of day tabs that swipes sideways, an Add
   * button, opens on today during the trip (else the first day), and blocks
   * open on a tap instead of dragging.
   */
  phone?: boolean
  /** The Day route switch when it lives elsewhere (the phone map button). */
  routeOn?: boolean
}) {
  const [days, setDays] = useState<ItineraryDay[] | null>(null)
  const [legs, setLegs] = useState<TravelLeg[]>([])
  // Legs linked to / from other trips (migration 0012, session 9).
  const [links, setLinks] = useState<LegLink[]>([])
  const [copying, setCopying] = useState<TravelLeg | null>(null)
  const [viewLinked, setViewLinked] = useState<TravelLeg | null>(null)
  const [linkNotice, setLinkNotice] = useState('')
  const [stops, setStops] = useState<Stop[]>([])
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState<{ leg: TravelLeg | null; preset?: { from: string; to: string } } | null>(null)
  const [acts, setActs] = useState<Activity[]>([])
  // Click on an empty spot: "Add at …" popup at that 15-minute mark (session 4).
  const [adding, setAdding] = useState<{ start: number; end: number } | null>(null)
  const [editing, setEditing] = useState<Activity | null>(null)
  const [editStop, setEditStop] = useState<Stop | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [confirmDay, setConfirmDay] = useState(false)
  // Day route: off every visit; on draws the day's route on the map and fades
  // the other pins (Hanh, session 6 — supersedes the old OTD Pins).
  const [routeChecked, setShowRoute] = useState(false)
  const showRoute = routeOn ?? routeChecked
  // Live Google leg routes (time + distance + road path), keyed by from>to:mode.
  const [legTimes, setLegTimes] = useState<Record<string, LegTime | null>>({})
  const wantLeg = useRef(new Set<string>())
  // A pin being dragged in from the Places panel: which day tab, or the timeline, is lit up.
  const [dropTarget, setDropTarget] = useState<string | 'timeline' | null>(null)
  const timeline = useRef<HTMLDivElement>(null)

  // This trip's own legs, plus legs linked in from other trips, placed on
  // the day matching their departure date (read only here).
  const loadLegs = useCallback(async (list: ItineraryDay[]): Promise<TravelLeg[]> => {
    const own = await fetchLegs(list.map(d => d.id))
    const ls = await fetchLegLinks(tripId).catch(() => [] as LegLink[])
    const incoming = ls.filter(k => k.direction === 'in')
    const linked = (await fetchLegsByIds(incoming.map(k => k.leg_id)).catch(() => [] as TravelLeg[])).map(l => ({
      ...l,
      day_id: list.find(d => d.date && d.date === l.from_date && !d.repeat_after)?.id ?? '',
      linkedFrom: incoming.find(k => k.leg_id === l.id)?.other_trip_name ?? 'another trip'
    }))
    const all = [...own, ...linked]
    setLinks(ls)
    setLegs(all)
    return all
  }, [tripId])

  const load = useCallback(async () => {
    try {
      let list = await fetchDays(tripId)
      if (await fillTripDates(tripId, start, end, list)) list = await fetchDays(tripId)
      const allLegs = await loadLegs(list)
      const allActs = await fetchActivities(list.map(d => d.id))
      const allStops = await fetchStops(list.map(d => d.id))
      // Flights across the date line get their repeat day (session 10).
      if (await syncRepeatDays(tripId, list, wantedRepeats(allLegs), d => repeatIsEmpty(d, { legs: allLegs, acts: allActs, stops: allStops }))) {
        list = await fetchDays(tripId)
      }
      setDays(list)
      setActs(allActs)
      setStops(allStops)
      setConnectors(await fetchConnectors(list.map(d => d.id)))
      setSelected(s => {
        if (s && list.some(d => d.id === s)) return s
        // On the phone a trip opens on today while it's under way (session 10).
        const today = phone ? list.find(d => d.date === todayISO() && !d.repeat_after) : undefined
        return (today ?? list[0])?.id ?? null
      })
    } catch (e) {
      setError((e as Error).message)
    }
  }, [tripId, start, end, loadLegs, phone])

  useEffect(() => {
    load()
  }, [load])

  // A stop points at a trip pin or a catalogue eatery; both flatten to a
  // StopItem so the timeline, connectors and day route handle them alike (M5).
  const itemById = useMemo(() => {
    const m = new Map<string, StopItem>()
    for (const p of pins) {
      m.set(p.id, { id: p.id, kind: p.source === 'spot' ? 'spot' : 'pin', name: p.name, lat: p.lat, lng: p.lng, michelin: p.michelin, category: p.category, subcategory: p.subcategory, subsubcategory: p.subsubcategory })
    }
    for (const e of eateries) {
      m.set(e.id, { id: e.id, kind: 'eatery', name: e.name, lat: e.lat, lng: e.lng, michelin: e.michelin, category: 'food', subcategory: e.cuisine, subsubcategory: e.dish })
    }
    return m
  }, [pins, eateries])
  const itemOf = useCallback((s: Stop) => itemById.get(stopTargetId(s)), [itemById])
  // A stop's reviews, for the status badge (pins and eateries keep their own).
  const reviewsOf = useCallback(
    (s: Stop): Review[] => (s.pin_id ? reviews.filter(r => r.pin_id === s.pin_id) : asReviews(eateryReviews, s.eatery_id as string)),
    [reviews, eateryReviews]
  )

  async function reloadStops() {
    if (days) setStops(await fetchStops(days.map(d => d.id)))
  }
  async function reloadConnectors() {
    if (days) setConnectors(await fetchConnectors(days.map(d => d.id)))
  }

  // Add a place (pin or eatery) to a day: at a given minute (timeline drop /
  // Add popup) or the next free slot (day tab drop, the "+" button). 60-min block.
  const addStop = useCallback(
    async (dayId: string, id: string, kind: StopKind, startMin?: number) => {
      const s = startMin ?? nextStopStart(stops.filter(st => st.day_id === dayId))
      const e = Math.min(24 * 60 - 1, s + STOP_MIN)
      try {
        await saveStop({ day_id: dayId, ...stopTarget(kind, id), start_time: hhmm(s), end_time: hhmm(e) })
        if (days) setStops(await fetchStops(days.map(d => d.id)))
      } catch (err) {
        setError((err as Error).message)
      }
    },
    [stops, days]
  )

  // The Places panel asked to add a place to the open day. Start caught up so a
  // request from a previous open session isn't re-run when the panel reopens.
  const lastReq = useRef(addRequest?.n ?? 0)
  useEffect(() => {
    if (addRequest && addRequest.n !== lastReq.current && selected) {
      lastReq.current = addRequest.n
      addStop(selected, addRequest.id, addRequest.kind)
    }
  }, [addRequest, selected, addStop])

  const dayIndex = days?.findIndex(d => d.id === selected) ?? -1
  const day = days && dayIndex >= 0 ? days[dayIndex] : null

  // Phone: the day tabs are one row; keep the open day in view (session 10).
  const tabsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!phone) return
    tabsRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ inline: 'center', block: 'nearest' })
  }, [phone, selected, days])

  // Start each day's timeline at 6:00, as in old Wanderlog.
  useEffect(() => {
    if (timeline.current) timeline.current.scrollTop = SCROLL_TO_HOUR * HOUR_PX
  }, [selected, days === null, form === null])

  // The 🔗 line on a block: where else this leg shows (or where it comes from).
  const alsoOn = (l: TravelLeg): string | null => {
    if (l.linkedFrom) return `Linked from: ${l.linkedFrom}`
    const names = links.filter(k => k.leg_id === l.id && k.direction === 'out').map(k => k.other_trip_name)
    return names.length ? `Also on: ${names.join(', ')}` : null
  }

  // Legs that leave on this day, and legs from an earlier day that land on
  // it; on a repeat day, the flights across the date line it continues.
  const { own, continuing } = useMemo(() => {
    if (!day) return { own: [] as TravelLeg[], continuing: [] as TravelLeg[] }
    const own = legs.filter(l => l.day_id === day.id)
    const continuing = day.repeat_after
      ? legsOnRepeat(day, legs)
      : day.date
        ? legs.filter(l => l.day_id !== day.id && l.to_date === day.date && (legDayOffset(l) ?? 0) > 0 && !repeatFor(l))
        : []
    return { own, continuing }
  }, [legs, day])
  // Where a leg's block goes on a continuing day (a repeat day starts it at the departure moment there).
  const contGeometry = useCallback(
    (l: TravelLeg) => {
      const g = continuationBlockGeometry(l)
      if (!day?.repeat_after) return g
      const top = (repeatStartMin(l) / 60) * HOUR_PX
      return { top, height: Math.max(22, g.height - top) }
    },
    [day]
  )
  // The repeat day a leg continues on, for its "continues on" note.
  const repeatNote = (l: TravelLeg): string | null => {
    const k = repeatFor(l)
    if (!k) return null
    const r = days?.find(d => d.repeat_after === k.after && d.date === k.date)
    return r ? `continues on ${shortDate(k.date)} · ${cityOf(l.to_location)} →` : null
  }

  const dayActs = useMemo(() => (day ? acts.filter(a => a.day_id === day.id) : []), [acts, day])
  const dayStops = useMemo(() => (day ? stops.filter(s => s.day_id === day.id) : []), [stops, day])
  // Stops in time order, for the connectors between consecutive places.
  const orderedStops = useMemo(() => [...dayStops].sort((a, b) => toMin(a.start_time) - toMin(b.start_time) || a.id.localeCompare(b.id)), [dayStops])
  const dayConnectors = useMemo(() => (day ? connectors.filter(c => c.day_id === day.id) : []), [connectors, day])

  const layout = useMemo(
    () =>
      computeColumnLayout([
        ...own.map(l => ({ id: l.id, ...legBlockGeometry(l) })),
        ...continuing.map(l => ({ id: `c-${l.id}`, ...contGeometry(l) })),
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
    [own, continuing, dayActs, dayStops, contGeometry]
  )

  // Fetch each set connector's live Google route (time, distance, road path).
  useEffect(() => {
    let live = true
    const modeOf = new Map(dayConnectors.map(c => [pairKey(c.from_stop_id, c.to_stop_id), c.mode]))
    for (let i = 0; i < orderedStops.length - 1; i++) {
      const from = orderedStops[i]
      const to = orderedStops[i + 1]
      const mode = modeOf.get(pairKey(from.id, to.id))
      if (!mode) continue
      const fp = itemOf(from)
      const tp = itemOf(to)
      if (!fp || !tp) continue
      const k = legKey(from.id, to.id, mode)
      if (wantLeg.current.has(k)) continue
      wantLeg.current.add(k)
      computeLeg({ lat: fp.lat, lng: fp.lng }, { lat: tp.lat, lng: tp.lng }, mode).then(r => {
        if (live) setLegTimes(t => ({ ...t, [k]: r }))
      })
    }
    return () => {
      live = false
    }
  }, [dayConnectors, orderedStops, itemOf])

  // Tell the trip page which day is open, which pins to keep bright, and the
  // day route to draw (Day route on → this day's pins + route; off → cleared).
  useEffect(() => {
    if (day) {
      const t = dayTab(day, dayIndex)
      onOpenDay({ id: day.id, label: `${t.top} ${t.main}`.trim() })
    } else onOpenDay(null)
  }, [day, dayIndex, onOpenDay])
  useEffect(() => {
    onOtdPins(showRoute && day ? dayStops.map(stopTargetId) : null)
  }, [showRoute, day, dayStops, onOtdPins])
  useEffect(() => {
    if (!showRoute || !day) return onDayRoute(null)
    const modeOf = new Map(dayConnectors.map(c => [pairKey(c.from_stop_id, c.to_stop_id), c.mode]))
    const segs: RouteSeg[] = []
    for (let i = 0; i < orderedStops.length - 1; i++) {
      const from = orderedStops[i]
      const to = orderedStops[i + 1]
      const fp = itemOf(from)
      const tp = itemOf(to)
      if (!fp || !tp) continue
      const mode = modeOf.get(pairKey(from.id, to.id)) ?? null
      const leg = mode ? legTimes[legKey(from.id, to.id, mode)] : null
      segs.push({ from: { lat: fp.lat, lng: fp.lng }, to: { lat: tp.lat, lng: tp.lng }, mode, path: leg?.path ?? null })
    }
    onDayRoute(segs)
  }, [showRoute, day, orderedStops, dayConnectors, legTimes, itemOf, onDayRoute])
  useEffect(() => () => { onOpenDay(null); onOtdPins(null); onDayRoute(null) }, [onOpenDay, onOtdPins, onDayRoute])

  async function reloadActs() {
    if (days) setActs(await fetchActivities(days.map(d => d.id)))
  }

  // Read the place ref a drag carries (set by the Places panel's rows): a pin
  // id, or an "eatery:<id>" token. hasPlace just checks a ref is being dragged.
  const draggedRef = (e: React.DragEvent) => e.dataTransfer.getData('text/plain')
  const hasPlace = (e: React.DragEvent) => e.dataTransfer.types.includes('text/plain')

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
    <aside className={`${styles.panel} ${wide ? styles.wide : ''} ${phone ? styles.phone : ''}`} aria-label="Itinerary">
      <div className={styles.head}>
        <strong>Itinerary</strong>
        {phone ? (
          day && (
            <button
              type="button"
              className={styles.addBtn}
              onClick={() => { setForm(null); setEditing(null); setEditStop(null); setAdding({ start: 9 * 60, end: 9 * 60 + NEW_BLOCK_MIN }) }}
            >
              + Add
            </button>
          )
        ) : (
          <>
            <IconBtn label={wide ? 'Back to normal width' : 'Widen to 200%'} pressed={wide} onClick={onWide}><WidenIcon /></IconBtn>
            <IconBtn label="Close the itinerary" onClick={onClose}><CloseIcon /></IconBtn>
          </>
        )}
      </div>

      {error && <p className={styles.error} role="alert">Couldn't load the itinerary: {error}</p>}
      {days === null && !error && <p className={styles.muted} role="status">Loading the itinerary…</p>}

      {days && (
        <>
          <div ref={tabsRef} className={styles.days} role="tablist" aria-label="Days">
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
                  onDragOver={e => { if (hasPlace(e)) { e.preventDefault(); setDropTarget(d.id) } }}
                  onDragLeave={() => setDropTarget(t => (t === d.id ? null : t))}
                  onDrop={e => {
                    if (!hasPlace(e)) return
                    e.preventDefault()
                    setDropTarget(null)
                    const ref = draggedRef(e)
                    if (ref) { const { id, kind } = parseStopRef(ref); addStop(d.id, id, kind) }
                  }}
                >
                  {t.top}
                  <b>{t.main}</b>
                  {tabCities(d, days, legs).map(c => <span key={c} className={styles.dayCity}>{c}</span>)}
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
                {routeOn === undefined && (
                  <label className={styles.showAll} title="Draw this day's route on the map and fade the other pins">
                    <input type="checkbox" checked={showRoute} onChange={e => setShowRoute(e.target.checked)} /> Day route
                  </label>
                )}
                {!phone && <IconBtn label="Add travel (flight, train, bus, own transport)" onClick={() => setForm({ leg: null })}><PlaneIcon /></IconBtn>}
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

              {linkNotice && <p className={styles.muted} role="status">{linkNotice}</p>}
              {copying ? (
                <div className={styles.formWrap}>
                  <CopyToTrip
                    leg={copying}
                    tripId={tripId}
                    linkedTo={links.filter(k => k.leg_id === copying.id && k.direction === 'out').map(k => k.other_trip_id)}
                    onCancel={() => setCopying(null)}
                    onCopied={async name => {
                      setCopying(null)
                      setLinkNotice(`Linked to ${name}: it shows there on its own date.`)
                      await loadLegs(days)
                    }}
                  />
                </div>
              ) : viewLinked ? (
                <div className={styles.formWrap}>
                  <LinkedLegCard leg={viewLinked} onClose={() => setViewLinked(null)} />
                </div>
              ) : form ? (
                <div className={styles.formWrap}>
                  <TravelForm
                    dayId={form.leg?.day_id ?? day.id /* an edited leg stays on its departure day */}
                    dayDate={day.date}
                    leg={form.leg}
                    preset={form.preset}
                    onCancel={() => setForm(null)}
                    onSave={async (fields: LegFields, id?: string) => {
                      await saveLeg(fields, id)
                      setForm(null)
                      await load() // also adds or removes a date-line repeat day
                    }}
                    onDelete={async id => {
                      await deleteLeg(id)
                      setForm(null)
                      await load()
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
                    onDragOver={e => { if (hasPlace(e)) { e.preventDefault(); setDropTarget('timeline') } }}
                    onDragLeave={e => { if (e.currentTarget === e.target) setDropTarget(t => (t === 'timeline' ? null : t)) }}
                    onDrop={e => {
                      if (!hasPlace(e)) return
                      e.preventDefault()
                      setDropTarget(null)
                      const ref = draggedRef(e)
                      if (!ref) return
                      const { id, kind } = parseStopRef(ref)
                      const y = e.clientY - e.currentTarget.getBoundingClientRect().top
                      addStop(day.id, id, kind, minuteAt(y, HOUR_PX, ADD_SNAP_MIN))
                    }}
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className={styles.hour} style={{ top: h * HOUR_PX }}>{`${h}:00`}</div>
                    ))}
                    {own.map(l => {
                      const g = legBlockGeometry(l)
                      return (
                        <LegCard key={l.id} leg={l} top={g.top} height={g.height} note={repeatNote(l) ?? (g.crossesMidnight ? 'continues next day →' : null)}
                          pos={blockPositionStyle(layout.get(l.id), GUTTER)} alsoOn={alsoOn(l)}
                          onClick={() => (l.linkedFrom ? setViewLinked(l) : setForm({ leg: l }))}
                          onCopy={l.linkedFrom ? undefined : () => { setLinkNotice(''); setCopying(l) }} />
                      )
                    })}
                    {continuing.map(l => {
                      const g = contGeometry(l)
                      return (
                        <LegCard key={`c-${l.id}`} leg={l} top={g.top} height={g.height}
                          note={day.repeat_after ? `← from ${shortDate(day.repeat_after)} · ${cityOf(l.from_location)}` : '← continued from the day before'}
                          pos={blockPositionStyle(layout.get(`c-${l.id}`), GUTTER)} alsoOn={alsoOn(l)}
                          onClick={() => (l.linkedFrom ? setViewLinked(l) : setForm({ leg: l }))} />
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
                    <StopConnectors
                      stops={orderedStops}
                      connectors={dayConnectors}
                      times={legTimes}
                      dayId={day.id}
                      onSet={async (dId, from, to, mode: ConnMode) => {
                        await saveConnector(dId, from, to, mode)
                        await reloadConnectors()
                      }}
                      onClear={async (from, to) => {
                        await clearConnector(from, to)
                        await reloadConnectors()
                      }}
                    />
                    {dayStops.map(s => {
                      const item = itemOf(s)
                      if (!item) return null
                      return (
                        <StopBlock
                          key={s.id}
                          stop={s}
                          item={item}
                          badge={pinBadge(reviewsOf(s))}
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
                          items={[...itemById.values()]}
                          onCancel={() => setAdding(null)}
                          onTravel={(st, en) => {
                            setAdding(null)
                            setForm({ leg: null, preset: { from: st, to: en } })
                          }}
                          onAddActivity={async (title, st, en, note) => {
                            await saveActivity({ day_id: day.id, title, start_time: st, end_time: en, note })
                            setAdding(null)
                            await reloadActs()
                          }}
                          onAddPlace={async (id, kind, st, en) => {
                            await saveStop({ day_id: day.id, ...stopTarget(kind, id), start_time: st, end_time: en })
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
                          initial={{ title: editing.title, start: editing.start_time.slice(0, 5), end: editing.end_time.slice(0, 5), note: editing.note }}
                          submitLabel="Save"
                          onCancel={() => setEditing(null)}
                          onSubmit={async (title, st, en, note) => {
                            await saveActivity({ title, start_time: st, end_time: en, note }, editing.id)
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
                    {editStop && itemOf(editStop) && (
                      <EditPop startPx={(toMin(editStop.start_time) / 60) * HOUR_PX} endPx={(toMin(editStop.end_time) / 60) * HOUR_PX} label={itemOf(editStop)!.name}>
                        <div className={styles.addHead}>
                          <strong>{itemOf(editStop)!.name}</strong>
                          <button type="button" className={styles.ib} aria-label="Close" onClick={() => setEditStop(null)}>×</button>
                        </div>
                        <StopEdit
                          key={editStop.id}
                          stop={editStop}
                          item={itemOf(editStop)!}
                          onSubmit={async (st, en, note) => {
                            await saveStop({ start_time: st, end_time: en, note }, editStop.id)
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
  alsoOn,
  onClick,
  onCopy
}: {
  leg: TravelLeg
  top: number
  height: number
  note: string | null
  pos: { left: string; width: string }
  alsoOn: string | null
  onClick: () => void
  /** The copy icon (link to another trip); absent on legs linked in. */
  onCopy?: () => void
}) {
  const cfg = LEG_MODE_CONFIG[leg.mode]
  const d = legDurationParts(leg)
  const plus = legDayOffset(leg)
  // Title first (session 9, like old Wanderlog), then airline + number under it.
  const carrierLine = [leg.carrier, leg.reference].filter(Boolean).join(' ')
  const name = leg.title || carrierLine || cfg.label
  const subLine = leg.title && carrierLine ? carrierLine : null
  const waiting = useWaiting(leg.id)
  return (
    <>
    <button type="button" className={`${styles.leg} ${waiting ? styles.waiting : ''}`} style={{ top, height: Math.max(height, 56), borderLeftColor: cfg.color, ...pos }} onClick={e => { e.stopPropagation(); onClick() }}>
      <span className={styles.legTop}>
        <Badge leg={leg} />
        <b>{name}</b>
      </span>
      {subLine && <span className={styles.legMeta}>{subLine}</span>}
      {waiting && <span className={styles.waitTag}>waiting to send</span>}
      <span className={styles.legRoute}>
        {endLabel(leg.from_location, leg.from_date, leg.from_time, leg.from_timezone)}
        <span className={styles.legSep} aria-label="to">
          •••<span className={MODE_EMOJI[leg.mode].flip ? styles.flip : undefined} aria-hidden="true">{MODE_EMOJI[leg.mode].emoji}</span>•••
        </span>
        {endLabel(leg.to_location, leg.to_date, leg.to_time, leg.to_timezone)}
        {plus ? <sup> +{plus}</sup> : null}
      </span>
      {d && <span className={styles.legMeta}>{d.hours}h {d.minutes}m</span>}
      {note && <span className={styles.legMeta}>{note}</span>}
      {leg.note && <span className={styles.blockNote}>{leg.note}</span>}
      {alsoOn && <span className={styles.legMeta}>🔗 {alsoOn}</span>}
    </button>
    {onCopy && (
      <button
        type="button"
        className={styles.legCopy}
        style={{ top: top + 6, left: `calc(${pos.left} + ${pos.width} - 34px)` }}
        aria-label={`Copy ${name} to another trip`}
        title="Copy to another trip"
        onClick={e => { e.stopPropagation(); onCopy() }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>
      </button>
    )}
    </>
  )
}

/** Pick another trip to show this leg on too (linked, session 9). */
function CopyToTrip({ leg, tripId, linkedTo, onCancel, onCopied }: { leg: TravelLeg; tripId: string; linkedTo: string[]; onCancel: () => void; onCopied: (name: string) => void }) {
  const [trips, setTrips] = useState<TripSummary[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => {
    fetchTrips().then(t => setTrips(t.filter(x => x.id !== tripId)), e => setErr((e as Error).message))
  }, [tripId])
  return (
    <div className={styles.copyBox} role="dialog" aria-label="Copy to another trip">
      <strong>Copy to another trip</strong>
      <span className={styles.muted0}>Linked: it shows there on {leg.from_date ?? 'its date'}, and changes here show there too.</span>
      {!leg.from_date && <span className={styles.muted0}>Give this leg a departure date first.</span>}
      {trips === null && !err && <span className={styles.muted0}>Loading your trips…</span>}
      {trips?.length === 0 && <span className={styles.muted0}>No other trips yet.</span>}
      <ul className={styles.copyList}>
        {trips?.map(t => {
          const done = linkedTo.includes(t.id)
          return (
            <li key={t.id}>
              <button
                type="button"
                disabled={busy || done || !leg.from_date}
                onClick={async () => {
                  setBusy(true)
                  setErr('')
                  try {
                    await linkLeg(leg.id, t.id)
                    onCopied(t.name)
                  } catch (e) {
                    setErr(`Couldn't link: ${(e as Error).message}`)
                    setBusy(false)
                  }
                }}
              >
                <b>{t.name}</b> <span>{placeLabel(t)}{done ? ' · already linked' : ''}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {err && <p className={styles.error} role="alert">{err}</p>}
      <button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button>
    </div>
  )
}

/** A leg linked in from another trip: shown read only, with where to edit it. */
function LinkedLegCard({ leg, onClose }: { leg: TravelLeg; onClose: () => void }) {
  const carrier = [leg.carrier, leg.reference].filter(Boolean).join(' ')
  return (
    <div className={styles.copyBox} role="dialog" aria-label="Linked travel">
      <strong>{leg.title || carrier || LEG_MODE_CONFIG[leg.mode].label}</strong>
      {leg.title && carrier && <span>{carrier}</span>}
      <span>{endLabel(leg.from_location, leg.from_date, leg.from_time, leg.from_timezone)} ••• {endLabel(leg.to_location, leg.to_date, leg.to_time, leg.to_timezone)}</span>
      <span className={styles.muted0}>Linked from {leg.linkedFrom}. Edit or delete it there; deleting removes it from every trip.</span>
      <button type="button" className="btn btn-quiet" onClick={onClose}>Close</button>
    </div>
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

function IconBtn({ label, pressed, onClick, children }: { label: string; pressed?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={styles.ib} aria-label={label} title={label} aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  )
}

const svg = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
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
