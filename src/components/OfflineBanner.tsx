import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { dismissFailed, newPage, offlineState, onOfflineChange, resolveClash, savedLabel, type Clash } from '../lib/offline'
import { fieldWord, shownValue } from '../lib/offlineQueue'
import { useQueue } from './useWaiting'
import styles from './OfflineBanner.module.css'

// The offline lines across the top (session 15, approved mockup):
// - dark: "Offline · showing what was saved Tue 9:42" while a page is answered
//   from the copy saved on this device (step 1);
// - yellow: "1 change waiting · sends when you're back online" while changes
//   wait on the device (step 2), "Sending 1 change…" as they go;
// - red: a change the database refused when it was sent, with Dismiss.
// Plus a short "Saved on this phone · sends when back online" note each time
// a change is put aside. It sets --offline-h so full-height pages make room.
export function useOffline() {
  const [s, setS] = useState(offlineState)
  useEffect(() => onOfflineChange(setS), [])
  return s
}

const changes = (n: number) => (n === 1 ? '1 change' : `${n} changes`)
const TABLE_WORDS: Record<string, string> = {
  itinerary_stops: 'a place on a day', itinerary_activities: 'an activity', travel_legs: 'a travel leg',
  itinerary_days: 'a day', itinerary_connectors: 'a connector', pins: 'a pin', pin_reviews: 'a WTG / VIS',
  spots: 'a spot', spot_reviews: 'a WTG / VIS', eateries: 'an eatery', eatery_reviews: 'a WTG / VIS',
  trips: 'the trip', profiles: 'your name', custom_dishes: 'a dish'
}

export default function OfflineBanner() {
  const { offline, savedAt, missing } = useOffline()
  const q = useQueue()
  const { pathname } = useLocation()
  useEffect(() => newPage(), [pathname])
  const [note, setNote] = useState(false)
  useEffect(() => {
    if (!q.lastQueuedAt) return
    setNote(true)
    const t = window.setTimeout(() => setNote(false), 3500)
    return () => window.clearTimeout(t)
  }, [q.lastQueuedAt])
  const lines = (offline ? 1 : 0) + (q.waiting > 0 ? 1 : 0) + (q.failed.length > 0 ? 1 : 0)
  useEffect(() => {
    document.documentElement.style.setProperty('--offline-h', `${lines * 34}px`)
  }, [lines])
  return (
    <>
      {lines > 0 && (
        <div className={styles.wrap}>
          {offline && (
            <div className={styles.line} role="status">
              <span className={styles.dot} aria-hidden="true" />
              {!savedAt
                ? "Offline · this page wasn't saved on this device yet"
                : missing
                  ? `Offline · saved ${savedLabel(savedAt)}; parts of this page weren't saved yet`
                  : `Offline · showing what was saved ${savedLabel(savedAt)}`}
            </div>
          )}
          {q.waiting > 0 && (
            <div className={styles.wait} role="status">
              {q.clash
                ? `${changes(q.waiting)} waiting · pick which version stays`
                : q.sending ? `Sending ${changes(q.waiting)}…` : `${changes(q.waiting)} waiting · sends when you're back online`}
            </div>
          )}
          {q.failed.length > 0 && (
            <div className={styles.fail} role="alert">
              <span className={styles.failText}>
                {q.failed.length === 1
                  ? `Couldn't save ${TABLE_WORDS[q.failed[0].table] ?? 'a change'} made offline: ${q.failed[0].message}`
                  : `${q.failed.length} changes made offline couldn't be saved`}
              </span>
              <button type="button" className={styles.dismiss} onClick={dismissFailed}>Dismiss</button>
            </div>
          )}
        </div>
      )}
      {note && <div className={styles.note} role="status">Saved on this device · sends when back online</div>}
      {q.clash && <ClashPicker clash={q.clash} />}
    </>
  )
}

// Step 3 (approved mockup screen 3): someone else changed the same thing while
// you were offline. Your change waits until you pick which version stays;
// your other changes to the same item still go either way.
function ClashPicker({ clash }: { clash: Clash }) {
  const [busy, setBusy] = useState(false)
  const who = clash.who ?? 'Someone else'
  const whose = clash.who ? `${clash.who}'s` : 'Theirs'
  const heading = [clash.label, clash.fields.map(f => fieldWord(f.key)).filter((w, i, a) => a.indexOf(w) === i).join(', ')].filter(Boolean).join(' · ')
  const pick = async (keep: 'mine' | 'theirs') => {
    setBusy(true)
    await resolveClash(keep)
  }
  const values = (side: 'mine' | 'theirs') =>
    clash.fields.map(f => (
      <span key={f.key} className={styles.clashValue}>
        {clash.fields.length > 1 && <em>{fieldWord(f.key)}: </em>}
        {shownValue(f[side])}
      </span>
    ))
  return (
    <div className={styles.backdrop}>
      <div className={styles.clash} role="dialog" aria-modal="true" aria-labelledby="clash-title">
        <h3 id="clash-title">{heading}</h3>
        <p>{who} changed this while you were offline. Which one stays?</p>
        <div className={`${styles.opt} ${styles.optMine}`}>
          <small>Yours · offline {savedLabel(clash.mineAt)}</small>
          {values('mine')}
        </div>
        <div className={styles.opt}>
          <small>{whose}{clash.theirsAt ? ` · ${savedLabel(clash.theirsAt)}` : ''}</small>
          {values('theirs')}
        </div>
        <div className={styles.btns}>
          <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => void pick('theirs')}>Keep {whose === 'Theirs' ? 'theirs' : whose}</button>
          <button type="button" className="btn" disabled={busy} onClick={() => void pick('mine')}>Keep mine</button>
        </div>
      </div>
    </div>
  )
}
