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


/** Strip accents and case so "Nha Trang", "nha trang" and "Nha Trang, Khánh Hòa" compare. */
function fold(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim()
}

/** Does a leg's arrival place name one of a trip's cities? */
export function arrivesInCity(toLocation: string, cities: (string | null | undefined)[]): boolean {
  const place = fold(toLocation)
  return cities.some(c => {
    const city = c ? fold(c) : ''
    return city.length > 1 && place.includes(city)
  })
}
