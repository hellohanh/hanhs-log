import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { isSupabaseConfigured } from '../../lib/supabase'
import { bundlePreview, joinTripsViaBundle, todayISO, tripDates, type BundleTrip } from '../../lib/trips'

// /wander/join-trips/:token: one invite link for several trips (session 14,
// approved mockup). Signed-in people only (no anonymous guests): see the
// trips, then Join all. Trips you're already on are marked and skipped.
export default function JoinTrips() {
  const { token = '' } = useParams()
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [trips, setTrips] = useState<BundleTrip[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (loading || !session) return
    let alive = true
    bundlePreview(token).then(
      t => alive && (t.length === 0 ? setError(STOPPED) : setTrips(t)),
      e => alive && setError(friendly((e as Error).message))
    )
    return () => { alive = false }
  }, [loading, session, token])

  async function join() {
    setBusy(true)
    setError('')
    try {
      await joinTripsViaBundle(token)
      navigate('/wander', { replace: true })
    } catch (e) {
      setBusy(false)
      setError(friendly((e as Error).message))
    }
  }

  const today = todayISO()
  const todo = trips?.filter(t => !t.already).length ?? 0
  const from = trips?.find(t => t.from_name)?.from_name
  return (
    <main className="page segoe" style={{ maxWidth: 640 }}>
      <p className="eyebrow">Wanderlog</p>
      <h1 style={{ fontSize: 44, margin: '12px 0 16px' }}>
        {trips ? `You're invited to ${trips.length} trip${trips.length === 1 ? '' : 's'}` : "You've been invited to some trips"}
      </h1>
      {!isSupabaseConfigured ? (
        <p className="lede">Sign-in isn't set up in this build, so invites can't be used.</p>
      ) : error ? (
        <>
          <p className="lede" role="alert">{error}</p>
          <p style={{ marginTop: 24 }}><Link to="/wander">Go to your trips</Link></p>
        </>
      ) : !session ? (
        <>
          <p className="lede">Sign in with your account to see the trips and join them all at once.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
            <Link to="/signin" className="btn">Sign in to join</Link>
          </div>
        </>
      ) : !trips ? (
        <p className="lede" role="status">Loading the trips…</p>
      ) : (
        <>
          <ul aria-label="Trips on this invite" style={{ listStyle: 'none', padding: 0, margin: '0 0 8px', fontSize: 18, lineHeight: 1.8 }}>
            {trips.map(t => (
              <li key={t.trip_id}>
                <b>{t.name}</b>
                {(t.start_date || t.end_date) && <span style={{ color: 'var(--muted)' }}> · {tripDates(t.start_date, t.end_date, today)}</span>}
                {t.already && <span style={{ color: 'var(--muted)' }}> · you're already on it</span>}
              </li>
            ))}
          </ul>
          {from && <p style={{ color: 'var(--muted)', margin: 0 }}>from {from}</p>}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
            {todo > 0 ? (
              <button type="button" className="btn" disabled={busy} onClick={() => void join()}>
                {busy ? 'Joining…' : todo === trips.length ? `Join all ${todo}` : `Join the other ${todo}`}
              </button>
            ) : (
              <Link to="/wander" className="btn">You're on all of them · Go to your trips</Link>
            )}
          </div>
        </>
      )}
    </main>
  )
}

const STOPPED = "This invite link doesn't work any more. It may have been stopped, so ask whoever invited you for a new one."
function friendly(message: string): string {
  if (/invalid or stopped/i.test(message)) return STOPPED
  if (/sign in with an account/i.test(message)) return 'This invite is for signed-in people. Sign in with an account to join.'
  return `Couldn't join: ${message}`
}
