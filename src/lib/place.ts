// Where a trip goes (pure, no network or database), kept apart so tests can use it directly.

/** Where a trip goes: Country and up to three cities (Country and Primary required). */
export interface TripPlace {
  country: string
  city_primary: string
  city_secondary: string | null
  city_tertiary: string | null
}

/** "Hồ Chí Minh City, Cần Giờ · Vietnam" */
export function placeLabel(p: TripPlace): string {
  const cities = [p.city_primary, p.city_secondary, p.city_tertiary].filter(Boolean).join(', ')
  return `${cities} · ${p.country}`
}

/** What a trip's map looks up: the Primary City in its Country. */
export function mapQuery(p: Pick<TripPlace, 'country' | 'city_primary'>): string {
  return `${p.city_primary.trim()}, ${p.country.trim()}`
}

