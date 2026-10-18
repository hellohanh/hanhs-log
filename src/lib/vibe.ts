import type { Michelin } from './pinDraw'

// MICHELIN chips and the Vibe ticks on the add / edit cards (session 14).
// No CSS or Supabase here, so the browser tests can import it (L38).

/** The MICHELIN chips: None / Selected / Bib on line one, the stars on line two (Hanh, session 14). */
export const MICHELIN_ROWS: { m: Michelin; label: string; aria: string }[][] = [
  [
    { m: null, label: 'None', aria: 'None' },
    // "Selected" keeps the old saved value 'mentioned' (E52 → session 14).
    { m: 'mentioned', label: 'Selected', aria: 'Selected' },
    { m: 'bib', label: 'Bib', aria: 'Bib Gourmand' }
  ],
  [
    { m: '1', label: '★', aria: '1 star' },
    { m: '2', label: '★★', aria: '2 stars' },
    { m: '3', label: '★★★', aria: '3 stars' }
  ]
]

/** Tooltip / plain words for a MICHELIN level. */
export function michelinWords(m: Michelin): string {
  if (!m) return ''
  if (m === 'mentioned') return 'MICHELIN Selected'
  if (m === 'bib') return 'MICHELIN Bib Gourmand'
  return `MICHELIN ${m} star${m === '1' ? '' : 's'}`
}

/** True for a starred level (the pin gets the stars chip). */
export function isStarred(m: Michelin): m is '1' | '2' | '3' {
  return m === '1' || m === '2' || m === '3'
}

export type VibeKey =
  | 'dine_in' | 'fine_dining' | 'street_food' | 'food_truck' | 'outdoor_seating'
  | 'community_seating' | 'food_court' | 'counter_seating' | 'takeaway'

export type Vibes = Record<VibeKey, boolean>

/**
 * The Vibe ticks in Hanh's two-column layout (dragged into place, session 14),
 * read row by row: [left, right]. Two-line labels break where `lines` says,
 * so each row's pair matches.
 */
export const VIBES: { key: VibeKey; label: string; lines: string[] }[] = [
  { key: 'dine_in', label: 'Dine in', lines: ['Dine in'] },
  { key: 'fine_dining', label: 'Fine dining', lines: ['Fine dining'] },
  { key: 'street_food', label: 'Street food', lines: ['Street food'] },
  { key: 'food_truck', label: 'Food truck', lines: ['Food truck'] },
  { key: 'outdoor_seating', label: 'Outdoor seating', lines: ['Outdoor seating'] },
  { key: 'community_seating', label: 'Community seating', lines: ['Community', 'seating'] },
  { key: 'food_court', label: 'Food court / hawker', lines: ['Food court /', 'hawker'] },
  { key: 'counter_seating', label: 'Counter / bar seating', lines: ['Counter / bar', 'seating'] },
  { key: 'takeaway', label: 'Takeaway / to-go', lines: ['Takeaway /', 'to-go'] }
]

/** The ticks off a saved row (missing ones are off). */
export function vibesOf(row?: Partial<Vibes> | null): Vibes {
  const out = {} as Vibes
  for (const v of VIBES) out[v.key] = row?.[v.key] === true
  return out
}

/** All ticks off, for a non-food pin. */
export function noVibes(): Vibes {
  return vibesOf(null)
}

/** The ticked labels in layout order, for the pin popup's line under the name. */
export function vibeLabels(row?: Partial<Vibes> | null): string[] {
  return VIBES.filter(v => row?.[v.key] === true).map(v => v.label)
}
