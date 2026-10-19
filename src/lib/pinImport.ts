import { supabase } from './supabase'
import { isSpot } from './pins'
import type { FoundPlace } from './pins'
import type { ImportItem, Row } from './pinImportRules'

// The old-Wanderlog pin import queue (E71, migration 0011). Claude turns
// Hanh's Wanderlog export into a prepared file — one entry per place, with its
// real city, the "English : Local" name parts (E72), a category guess, the
// MICHELIN check and the old pin copies. Hanh loads it once; each place then
// waits as 'pending' until it's saved (trip pin or Savorlog eatery) or skipped
// for good. The pure helpers live in pinImportRules.

export * from './pinImportRules'

function db() {
  if (!supabase) throw new Error("Sign-in isn't set up in this build.")
  return supabase
}

// ---- Database ----

export async function fetchImport(): Promise<ImportItem[]> {
  const { data, error } = await db()
    .from('pin_import_items')
    .select('id, google_place_id, city, country, lat, lng, prefill, copies, status, saved_pin_id, saved_eatery_id')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as ImportItem[]
}

/** Loads the prepared places; a place already loaded (even if skipped) is left alone. */
export async function loadImport(rows: Row[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await db()
      .from('pin_import_items')
      .upsert(rows.slice(i, i + 100), { onConflict: 'owner_id,google_place_id', ignoreDuplicates: true })
    if (error) throw error
  }
}

export async function markSaved(id: string, saved: { pin?: string; eatery?: string }): Promise<void> {
  // saved_pin_id links to trip pins only; a place saved to Roaminglog (a spot,
  // session 14) is just ticked off.
  const pin = saved.pin && !isSpot(saved.pin) ? saved.pin : null
  const { error } = await db()
    .from('pin_import_items')
    .update({ status: 'saved', saved_pin_id: pin, saved_eatery_id: saved.eatery ?? null, done_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function markSkipped(id: string): Promise<void> {
  const { error } = await db().from('pin_import_items').update({ status: 'skipped', done_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

/** Whether you own the Savorlog circle (only the owner loads an import). */
export async function amSavorlogOwner(): Promise<boolean> {
  const { data, error } = await db().rpc('savorlog_people')
  if (error) return false
  return ((data ?? []) as { is_me: boolean; is_owner: boolean }[]).some(p => p.is_me && p.is_owner)
}

/** The Google place for a saved place ID, or null if Google no longer knows it. */
export async function placeById(id: string, fallback: { name: string; lat: number; lng: number }): Promise<FoundPlace | null> {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'id,displayName,formattedAddress,location' }
    })
    if (!res.ok) return null
    const p = (await res.json()) as { id?: string; displayName?: { text: string }; formattedAddress?: string; location?: { latitude: number; longitude: number } }
    return {
      id: p.id ?? id,
      name: p.displayName?.text ?? fallback.name,
      address: p.formattedAddress ?? null,
      lat: p.location?.latitude ?? fallback.lat,
      lng: p.location?.longitude ?? fallback.lng
    }
  } catch {
    return null
  }
}

