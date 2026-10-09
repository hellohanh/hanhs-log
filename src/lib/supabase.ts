import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Same Supabase project as Wanderlog. Both values are public by design (the
// "anon" key only grants what the database's security rules allow) but they
// still come from GitHub secrets at build time rather than living in the
// code. VITE_SUPABASE_URL must be the bare project URL (Wanderlog L18).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null
export const isSupabaseConfigured = supabase !== null
