import { useEffect, useRef, useState } from 'react'
import { bundleUrl, stopTripBundle, type TripBundle, type TripSummary } from '../../lib/trips'
import styles from './ShareDialog.module.css'

// One invite link for several trips (session 14, approved mockup): the new
// link with Copy, and your links that still work, each with Copy and Stop.

function useModal(onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  return { ref, close: () => ref.current?.close(), onClose }
}

function CopyLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  const link = bundleUrl(token)
  return (
    <div className={styles.linkRow}>
      <input readOnly aria-label="Invite link" value={link} onFocus={e => e.currentTarget.select()} className={styles.linkInput} />
      <button type="button" className="btn" onClick={async () => {
        try { await navigator.clipboard.writeText(link); setCopied(true) } catch { /* select-and-copy by hand */ }
      }}>{copied ? 'Copied' : 'Copy'}</button>
    </div>
  )
}

const names = (ids: string[], trips: TripSummary[]) =>
  ids.map(id => trips.find(t => t.id === id)?.name).filter(Boolean) as string[]

export function NewBundleDialog({ token, tripIds, trips, onClose }: { token: string; tripIds: string[]; trips: TripSummary[]; onClose: () => void }) {
  const m = useModal(onClose)
  return (
    <dialog ref={m.ref} className={`segoe ${styles.dialog} ${styles.small}`} aria-labelledby="bundle-title" onClose={onClose}>
      <div className={styles.head}>
        <h2 id="bundle-title" className={styles.title}>One invite link for {tripIds.length} trip{tripIds.length === 1 ? '' : 's'}</h2>
      </div>
      <section className={styles.section}>
        <CopyLink token={token} />
        <p className={styles.help}>Whoever opens it (signed in) joins:</p>
        <ul style={{ margin: 0, paddingLeft: 20 }}>{names(tripIds, trips).map(n => <li key={n}>{n}</li>)}</ul>
        <button type="button" className="btn btn-quiet" style={{ alignSelf: 'flex-start', marginTop: 8 }} onClick={m.close}>Done</button>
      </section>
    </dialog>
  )
}

export function BundlesDialog({ bundles, trips, onChanged, onClose }: { bundles: TripBundle[]; trips: TripSummary[]; onChanged: () => void; onClose: () => void }) {
  const m = useModal(onClose)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [error, setError] = useState('')
  async function stop(id: string) {
    setError('')
    try {
      await stopTripBundle(id)
      setConfirm(null)
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <dialog ref={m.ref} className={`segoe ${styles.dialog} ${styles.small}`} aria-labelledby="bundles-title" onClose={onClose}>
      <div className={styles.head}>
        <h2 id="bundles-title" className={styles.title}>Several-trips links</h2>
        <button type="button" className={styles.close} aria-label="Close" onClick={m.close}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
      {bundles.length === 0 && <p className={styles.help}>No links yet. Use Invite to several trips to make one.</p>}
      {error && <p role="alert" style={{ color: '#C8352F' }}>{error}</p>}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {bundles.map(b => (
          <li key={b.id} className={styles.section} data-testid="bundle">
            <b>{names(b.trip_ids, trips).join(' · ') || 'Trips you no longer own'}</b>
            <CopyLink token={b.token} />
            {confirm === b.id ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }} role="alert">
                <span>Stop this link? It won't work any more.</span>
                <button type="button" className="btn" onClick={() => void stop(b.id)}>Stop</button>
                <button type="button" className="btn btn-quiet" onClick={() => setConfirm(null)}>Keep</button>
              </div>
            ) : (
              <button type="button" className={`btn btn-quiet ${styles.textBtn}`} onClick={() => setConfirm(b.id)}>Stop this link</button>
            )}
          </li>
        ))}
      </ul>
    </dialog>
  )
}
