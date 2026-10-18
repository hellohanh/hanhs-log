import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import { customDishKey, setCustomDishes, slug, titleCase, categoryOf, type CustomDish } from './pinCatalog'

// Dishes people add to a cuisine's Main dish list (migration 0017, session
// 14): loaded once, merged into the catalogue (setCustomDishes) so every menu,
// tree and pin sees them, and shared by everyone who sees the catalogue.

let dishes: CustomDish[] = []
let version = 0
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

function publish(next: CustomDish[]) {
  dishes = next
  setCustomDishes(dishes)
  version++
  listeners.forEach(l => l())
}

export function loadCustomDishes(): Promise<void> {
  if (!supabase) return Promise.resolve()
  if (!loading) {
    loading = (async () => {
      const { data, error } = await supabase!.from('custom_dishes').select('cuisine, key, label')
      if (!error && data) publish(data as CustomDish[])
    })()
  }
  return loading
}

/** Re-renders when the added dishes change; loads them the first time. */
export function useCustomDishes(): number {
  void loadCustomDishes()
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => version
  )
}

/**
 * Adds a dish to a cuisine (tidied like place names). If that cuisine already
 * has the dish (ignoring accents and capitals), returns the existing key
 * instead of adding a copy.
 */
export async function addCustomDish(cuisine: string, typed: string): Promise<string> {
  const label = titleCase(typed.trim())
  if (!label) throw new Error('Type the dish first.')
  const existing = categoryOf('food')?.subs.find(s => s.key === cuisine)?.leaves?.find(l => slug(l.label) === slug(label))
  if (existing) return existing.key
  const key = customDishKey(label)
  if (!supabase) throw new Error("Sign-in isn't set up in this build.")
  const { error } = await supabase.from('custom_dishes').insert({ cuisine, key, label })
  if (error && error.code !== '23505') throw new Error(error.message)
  if (!dishes.some(d => d.cuisine === cuisine && d.key === key)) publish([...dishes, { cuisine, key, label }])
  return key
}
