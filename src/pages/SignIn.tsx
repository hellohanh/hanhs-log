import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { isSupabaseConfigured } from '../lib/supabase'

type Status = 'idle' | 'sending' | 'sent' | 'error'

export default function SignIn() {
  const { session, loading, signInWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  if (!loading && session) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setStatus('sending')
    const { error } = await signInWithEmail(email.trim())
    if (error) {
      setStatus('error')
      setMessage(error)
    } else {
      setStatus('sent')
    }
  }

  return (
    <main className="page" style={{ maxWidth: 520 }}>
      <h1 style={{ fontSize: 44, marginBottom: 12 }}>Sign in</h1>
      {!isSupabaseConfigured ? (
        <p className="lede">Sign-in isn't set up in this build yet.</p>
      ) : status === 'sent' ? (
        <p className="lede" role="status">
          Check your email for a sign-in link. It opens Hanh's Log already signed in.
        </p>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
          <label htmlFor="email" style={{ fontWeight: 500 }}>
            Email address
          </label>
          <input
            id="email"
            className="field"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <button type="submit" className="btn" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
          </button>
          {status === 'error' && (
            <p role="alert" style={{ margin: 0, color: 'var(--accent)' }}>
              {message}
            </p>
          )}
        </form>
      )}
    </main>
  )
}
