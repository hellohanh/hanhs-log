import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseHost } from './supabase'

interface AuthState {
  session: Session | null
  loading: boolean
  signInWithEmail: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(supabase !== null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  async function signInWithEmail(email: string) {
    if (!supabase) return { error: 'Sign-in is not set up in this build.' }
    // The link in the email brings the person back to Hanh's Log itself
    // (main site or the preview they started from).
    const redirectTo = window.location.origin + import.meta.env.BASE_URL
    try {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })
      if (!error) return { error: null }
      if (/fetch/i.test(error.message)) return { error: unreachable() }
      return { error: error.message }
    } catch {
      return { error: unreachable() }
    }
  }

  async function signOut() {
    await supabase?.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, loading, signInWithEmail, signOut }}>{children}</AuthContext.Provider>
  )
}

function unreachable() {
  const host = supabaseHost ?? 'the sign-in service'
  const hint = supabaseHost && !supabaseHost.endsWith('.supabase.co')
    ? ' That address doesn’t look like a Supabase project (it should end in .supabase.co).'
    : ' Check your connection and try again.'
  return `Couldn’t reach ${host}.${hint}`
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
