import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { isSupabaseConfigured } from '../../lib/supabase'
import { joinTrip, signInAsGuest } from '../../lib/trips'

// /wander/join/:token: the invite link. Signed in → join straight away.
// Not signed in → one "Join trip" button that signs in without an email
// (like Wanderlog's guests), then joins. The first-name question comes up
// on the trip page.
export default function JoinTrip() {
  const { token = '' } = useParams()
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (loading || !session || started.current) return
    started.current = true
    setBusy(true)
    joinTrip(token).then(
      id => navigate(`/wander/trip/${id}`, { replace: true }),
      e => {
        setBusy(false)
        setError(friendly((e as Error).message))
      }
    )
  }, [loading, session, token, navigate])

  async function joinAsGuest() {
    setBusy(true)
    setError('')
    try {
      await signInAsGuest() // the session change above then joins the trip
    } catch (e) {
      setBusy(false)
      setError(`Couldn't join: ${(e as Error).message}`)
    }
  }

  return (
    <main className="page segoe" style={{ maxWidth: 640 }}>
      <p className="eyebrow">Wanderlog</p>
      <h1 style={{ fontSize: 48, margin: '12px 0 16px' }}>You've been invited to a trip</h1>
      {!isSupabaseConfigured ? (
        <p className="lede">Sign-in isn't set up in this build, so invites can't be used.</p>
      ) : error ? (
        <>
          <p className="lede" role="alert">{error}</p>
          <p style={{ marginTop: 24 }}><Link to="/wander">Go to your trips</Link></p>
        </>
      ) : session || busy || loading ? (
        <p className="lede" role="status">Joining the trip…</p>
      ) : (
        <>
          <p className="lede">
            Join to see the trip's places and plans, and add your own. No email needed: you'll just be asked for a first name.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
            <button type="button" className="btn" onClick={joinAsGuest}>Join trip</button>
            <Link to="/signin" className="btn btn-quiet">I have an account — sign in first</Link>
          </div>
        </>
      )}
    </main>
  )
}

function friendly(message: string): string {
  if (/invalid invite token/i.test(message)) {
    return "This invite link doesn't work. It may have been reset, so ask the trip's owner for a new one."
  }
  return `Couldn't join the trip: ${message}`
}
