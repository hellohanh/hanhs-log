import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { isSupabaseConfigured } from '../../lib/supabase'
import { joinSavorlog } from '../../lib/eateries'

// /savor/join/:token: the Savorlog circle's invite. Signed-in family join
// straight away; unlike trip invites there's no anonymous guest join — the
// circle is signed-in family only (4e). The first-name question comes up on
// the Savorlog page's Family dialog.
export default function JoinSavor() {
  const { token = '' } = useParams()
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const started = useRef(false)

  useEffect(() => {
    if (loading || !session || started.current) return
    started.current = true
    joinSavorlog(token).then(
      () => navigate('/savor', { replace: true }),
      e => setError(friendly((e as Error).message))
    )
  }, [loading, session, token, navigate])

  return (
    <main className="page segoe" style={{ maxWidth: 640 }}>
      <p className="eyebrow">Savorlog</p>
      <h1 style={{ fontSize: 48, margin: '12px 0 16px' }}>You've been invited to Savorlog</h1>
      {!isSupabaseConfigured ? (
        <p className="lede">Sign-in isn't set up in this build, so invites can't be used.</p>
      ) : error ? (
        <>
          <p className="lede" role="alert">{error}</p>
          <p style={{ marginTop: 24 }}><Link to="/savor">Go to Savorlog</Link></p>
        </>
      ) : session ? (
        <p className="lede" role="status">Joining the circle…</p>
      ) : (
        <>
          <p className="lede">Sign in with your account to join the family's eatery catalogue and add your own finds.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
            <Link to="/signin" className="btn">Sign in to join</Link>
          </div>
        </>
      )}
    </main>
  )
}

function friendly(message: string): string {
  if (/invalid invite token/i.test(message)) return "This invite link doesn't work. It may have been reset, so ask whoever invited you for a new one."
  if (/sign in with an account/i.test(message)) return 'The Savorlog circle is for signed-in family — sign in with an account to join.'
  return `Couldn't join: ${message}`
}
