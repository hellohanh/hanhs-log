import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Same Supabase project as Wanderlog. Both values are public by design (the
// "anon" key only grants what the database's security rules allow) but they
// still come from GitHub secrets at build time rather than living in the
// code. Supabase wants the bare project URL (Wanderlog L18), so a pasted
// value is tidied first: spaces trimmed, https:// added if missing, and any
// path such as /rest/v1/ removed.
export function cleanProjectUrl(raw: string | undefined): string | null {
  let v = (raw ?? '').trim().replace(/^["']|["']$/g, '')
  if (!v) return null
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`
  try {
    const u = new URL(v)
    return `${u.protocol}//${u.host}`
  } catch {
    return null
  }
}

const url = cleanProjectUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined)
const anonKey = ((import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '').trim().replace(/^["']|["']$/g, '')

function makeClient(): SupabaseClient | null {
  if (!url || !anonKey) return null
  try {
    return createClient(url, anonKey)
  } catch (e) {
    // A bad setting must never blank the whole site; sign-in just stays off.
    console.warn('Sign-in is off: the Supabase settings could not be used.', e)
    return null
  }
}

export const supabase: SupabaseClient | null = makeClient()
export const isSupabaseConfigured = supabase !== null
