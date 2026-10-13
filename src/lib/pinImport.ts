import { supabase } from './supabase'
import type { Michelin } from './pinDraw'
import type { FoundPlace } from './pins'

// The old-Wanderlog pin import queue (E71, migration 0011). Claude turns
// Hanh's Wanderlog export into a prepared file — one entry per place, with its
// real city, the "English : Local" name parts (E72), a category guess, the
// MICHELIN check and the old pin copies. Hanh loads it once; each place then
// waits as 'pending' until it's saved (trip pin or Savorlog eatery) or skipped
// for good. CSS-free so tests can import it (L38).

/** The add-card values Claude prepared for one place. */
export interface ImportPrefill {
  name_en: string | null
  name_local: string | null
  category: string
  sub: string | null
  leaf: string | null
  michelin: Michelin
  michelin_year: number | null
  michelin_url: string | null
  street_food: boolean
  fine_dining: boolean
  note: string | null
  why: string | null
}

/** One old Wanderlog pin this place came from. */
export interface OldCopy {
  trip: string
  name: string
  category: string
  icon: string | null
  note: string | null
}

export type ImportStatus = 'pending' | 'saved' | 'skipped'

export interface ImportItem {
  id: string
  google_place_id: string
  city: string
  country: string | null
  lat: number
  lng: number
  prefill: ImportPrefill
  copies: OldCopy[]
  status: ImportStatus
  saved_pin_id: string | null
  saved_eatery_id: string | null
}

/** Category order inside a city (Hanh, session 9): food last. */
export const IMPORT_ORDER = ['accommodation', 'airport', 'attraction', 'shopping', 'transport', 'food'] as const

function db() {
  if (!supabase) throw new Error("Sign-in isn't set up in this build.")
  return supabase
}

// ---- The prepared file ----

type Row = Omit<ImportItem, 'id' | 'status' | 'saved_pin_id' | 'saved_eatery_id'>

/**
 * Reads the prepared file Claude made from the Wanderlog export. Throws a
 * plain-English error when it isn't one (e.g. the raw export was picked).
 */
export function parsePrepared(text: string): Row[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("That file isn't readable JSON.")
  }
  const d = data as { app?: string; places?: unknown[]; trips?: unknown[] }
  if (d?.app === "Hanh's Wanderlog" && Array.isArray(d.trips)) {
    throw new Error("That's the raw Wanderlog export. Load the prepared file Claude made from it (hanhs-log-import-….json).")
  }
  if (d?.app !== "Hanh's Log import" || !Array.isArray(d.places)) {
    throw new Error("That isn't a Hanh's Log import file.")
  }
  return d.places.map((raw, i) => {
    const p = raw as Record<string, unknown>
    const where = `place ${i + 1}`
    if (typeof p.place_id !== 'string' || !p.place_id) throw new Error(`${where} has no Google place ID.`)
    if (typeof p.city !== 'string' || !p.city) throw new Error(`${where} has no city.`)
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number') throw new Error(`${where} has no location.`)
    if (typeof p.category !== 'string') throw new Error(`${where} has no category.`)
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)
    const m = p.michelin
    return {
      google_place_id: p.place_id,
      city: p.city,
      country: str(p.country),
      lat: p.lat,
      lng: p.lng,
      prefill: {
        name_en: str(p.name_en),
        name_local: str(p.name_local),
        category: p.category,
        sub: str(p.sub),
        leaf: str(p.leaf),
        michelin: m === 'mentioned' || m === '1' || m === '2' || m === '3' ? m : null,
        michelin_year: typeof p.michelin_year === 'number' ? p.michelin_year : null,
        michelin_url: str(p.michelin_url),
        street_food: p.street_food === true,
        fine_dining: p.fine_dining === true,
        note: str(p.note),
        why: str(p.why)
      },
      copies: Array.isArray(p.copies) ? (p.copies as OldCopy[]) : []
    }
  })
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
  const { error } = await db()
    .from('pin_import_items')
    .update({ status: 'saved', saved_pin_id: saved.pin ?? null, saved_eatery_id: saved.eatery ?? null, done_at: new Date().toISOString() })
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

// ---- Grouping (pure) ----

export interface Tally {
  done: number
  total: number
}

export const tally = (items: ImportItem[]): Tally => ({ done: items.filter(i => i.status !== 'pending').length, total: items.length })

/** Cities, biggest first, with their progress. */
export function cityList(items: ImportItem[]): { city: string; country: string | null; tally: Tally }[] {
  const by = new Map<string, ImportItem[]>()
  for (const it of items) by.set(it.city, [...(by.get(it.city) ?? []), it])
  return [...by.entries()]
    .map(([city, list]) => ({ city, country: list[0].country, tally: tally(list) }))
    .sort((a, b) => b.tally.total - a.tally.total || a.city.localeCompare(b.city))
}

/** One city's places in one category, in a steady order (by name). */
export function categoryItems(items: ImportItem[], city: string, category: string): ImportItem[] {
  return items
    .filter(i => i.city === city && i.prefill.category === category)
    .sort((a, b) => displayName(a).localeCompare(displayName(b)))
}

export function displayName(i: ImportItem): string {
  const { name_en, name_local } = i.prefill
  return name_en && name_local ? `${name_en} : ${name_local}` : name_en || name_local || i.copies[0]?.name || 'Unnamed place'
}

/** The next place still waiting after `from` (wrapping round), or null when all are done. */
export function nextPending(list: ImportItem[], from: number): number | null {
  for (let k = 1; k <= list.length; k++) {
    const j = (from + k) % list.length
    if (list[j].status === 'pending') return j
  }
  return null
}
