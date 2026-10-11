import { categoryOf } from './pinCatalog'

// Groups the eatery catalogue into Savorlog's two levels — country (cuisine) →
// main dish — in docs/pin-standard.md order, only including branches that have
// eateries (E60). An eatery whose dish isn't set (or isn't in the catalogue)
// sits directly under its country; one whose cuisine isn't known sits under a
// final "Other" country. Pure (no React, no CSS) so tests import it directly.

export interface DishNode<T> {
  key: string
  label: string
  count: number
  eateries: T[]
}
export interface CountryNode<T> {
  key: string
  label: string
  color: string
  count: number
  dishes: DishNode<T>[]
  /** Eateries with no (or an unknown) dish — shown straight under the country. */
  loose: T[]
}

type Placed = { cuisine: string | null; dish: string | null }

const FOOD = categoryOf('food')
const OTHER = { key: '_other', label: 'Other', color: '#8A8780' }

export function buildCountryTree<T extends Placed>(eateries: T[]): CountryNode<T>[] {
  const out: CountryNode<T>[] = []
  const cuisines = FOOD?.subs ?? []
  const known = new Set(cuisines.map(s => s.key))

  const makeCountry = (key: string, label: string, color: string, inCountry: T[]): CountryNode<T> => {
    const sub = cuisines.find(s => s.key === key)
    const leafKeys = new Set((sub?.leaves ?? []).map(l => l.key))
    const node: CountryNode<T> = { key, label, color, count: inCountry.length, dishes: [], loose: [] }
    node.loose = inCountry.filter(e => !e.dish || !leafKeys.has(e.dish))
    for (const leaf of sub?.leaves ?? []) {
      const inDish = inCountry.filter(e => e.dish === leaf.key)
      if (inDish.length > 0) node.dishes.push({ key: leaf.key, label: leaf.label, count: inDish.length, eateries: inDish })
    }
    return node
  }

  for (const sub of cuisines) {
    const inCountry = eateries.filter(e => e.cuisine === sub.key)
    if (inCountry.length > 0) out.push(makeCountry(sub.key, sub.label, sub.color, inCountry))
  }
  const leftover = eateries.filter(e => !e.cuisine || !known.has(e.cuisine))
  if (leftover.length > 0) out.push(makeCountry(OTHER.key, OTHER.label, OTHER.color, leftover))
  return out
}
